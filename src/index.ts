#!/usr/bin/env node
/**
 * Wyze MCP Server
 *
 * An MCP server for controlling Wyze smart home devices.
 * Requires environment variables: WYZE_EMAIL, WYZE_PASSWORD, WYZE_API_KEY, WYZE_KEY_ID
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initAuthFromEnv } from "./auth.js";
import {
  getDeviceList,
  findDevice,
  toDeviceInfo,
  getDeviceStatus,
  setDevicePower,
  setDeviceBrightness,
  setDeviceColorTemp,
  setDeviceColor,
  controlLock,
  getLockInfo,
  runDeviceAction,
  handleApiError,
} from "./api.js";
import { CHARACTER_LIMIT } from "./constants.js";
import type { DeviceInfo, DeviceStatus } from "./types.js";

// Response format enum
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// Create MCP server
const server = new McpServer({
  name: "wyze-mcp-server",
  version: "1.0.0",
});

// Zod schemas
const ListDevicesSchema = z
  .object({
    device_type: z
      .string()
      .optional()
      .describe(
        "Filter by device type (e.g., 'Camera', 'Plug', 'Light', 'Lock', 'Thermostat')"
      ),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
  })
  .strict();

const DeviceIdentifierSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
  })
  .strict();

const PowerControlSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname"),
  })
  .strict();

const BrightnessSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname (must be a light/bulb)"),
    brightness: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe("Brightness level from 1 to 100"),
  })
  .strict();

const ColorTempSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname (must be a light/bulb)"),
    color_temp: z
      .number()
      .int()
      .min(2700)
      .max(6500)
      .describe("Color temperature in Kelvin (2700=warm, 6500=cool)"),
  })
  .strict();

const ColorSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname (must be a color bulb)"),
    color: z
      .string()
      .describe("RGB hex color (e.g., 'ff0000' for red, '00ff00' for green, '0000ff' for blue)"),
  })
  .strict();

const LockControlSchema = z
  .object({
    device: z
      .string()
      .describe("Lock device MAC address or nickname"),
  })
  .strict();

const RunActionSchema = z
  .object({
    device: z
      .string()
      .describe("Device MAC address or nickname"),
    action_key: z
      .string()
      .describe("Action to run (e.g., 'power_on', 'power_off', 'garage_door_trigger')"),
    provider_key: z
      .string()
      .optional()
      .describe("Provider key (defaults to device MAC)"),
  })
  .strict();

// Helper: Format devices list as markdown
function formatDevicesMarkdown(devices: DeviceInfo[]): string {
  if (devices.length === 0) {
    return "No devices found.";
  }

  const lines = [`# Wyze Devices (${devices.length} total)`, ""];

  // Group by type
  const byType = new Map<string, DeviceInfo[]>();
  for (const device of devices) {
    const type = device.product_type || "Unknown";
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(device);
  }

  for (const [type, typeDevices] of byType) {
    lines.push(`## ${type} (${typeDevices.length})`);
    lines.push("");
    for (const device of typeDevices) {
      const status = device.is_online ? "Online" : "Offline";
      lines.push(`### ${device.nickname}`);
      lines.push(`- **MAC**: ${device.mac}`);
      lines.push(`- **Model**: ${device.product_model}`);
      lines.push(`- **Status**: ${status}`);
      if (device.firmware_ver) {
        lines.push(`- **Firmware**: ${device.firmware_ver}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Helper: Format device status as markdown
function formatStatusMarkdown(status: DeviceStatus): string {
  const lines = [
    `# ${status.nickname}`,
    "",
    `- **MAC**: ${status.mac}`,
    `- **Type**: ${status.product_type}`,
    `- **Model**: ${status.product_model}`,
    `- **Status**: ${status.is_online ? "Online" : "Offline"}`,
  ];

  if (status.firmware_ver) {
    lines.push(`- **Firmware**: ${status.firmware_ver}`);
  }

  if (Object.keys(status.properties).length > 0) {
    lines.push("", "## Properties");
    for (const [key, value] of Object.entries(status.properties)) {
      lines.push(`- **${key}**: ${value}`);
    }
  }

  return lines.join("\n");
}

// Register tools

// List devices
server.registerTool(
  "wyze_list_devices",
  {
    title: "List Wyze Devices",
    description: `List all Wyze smart home devices associated with the account.

Returns device information including MAC address, nickname, type, model, and online status.
Use the device_type parameter to filter by device type.

Supported device types: Camera, Plug, Light, MeshLight, Lock, ContactSensor, MotionSensor, Thermostat, Switch, RobotVacuum, Doorbell, GarageDoor, Sprinkler

Examples:
- List all devices: wyze_list_devices()
- List only cameras: wyze_list_devices(device_type="Camera")
- List only lights: wyze_list_devices(device_type="Light")`,
    inputSchema: ListDevicesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      let devices = await getDeviceList();

      // Filter by type if specified
      if (params.device_type) {
        const filterType = params.device_type.toLowerCase();
        devices = devices.filter(
          (d) => d.product_type.toLowerCase() === filterType
        );
      }

      const deviceInfos = devices.map(toDeviceInfo);

      const output = {
        count: deviceInfos.length,
        devices: deviceInfos,
      };

      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        textContent = formatDevicesMarkdown(deviceInfos);
      } else {
        textContent = JSON.stringify(output, null, 2);
      }

      // Truncate if needed
      if (textContent.length > CHARACTER_LIMIT) {
        textContent =
          textContent.slice(0, CHARACTER_LIMIT) +
          "\n\n... (truncated, use device_type filter to see fewer results)";
      }

      return {
        content: [{ type: "text", text: textContent }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Get device status
server.registerTool(
  "wyze_get_device_status",
  {
    title: "Get Device Status",
    description: `Get detailed status and properties of a specific Wyze device.

Provide either the device MAC address or nickname to identify the device.
Returns current state, properties, and configuration.

Examples:
- By nickname: wyze_get_device_status(device="Living Room Light")
- By MAC: wyze_get_device_status(device="ABCD1234")`,
    inputSchema: DeviceIdentifierSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      const status = await getDeviceStatus(device);

      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        textContent = formatStatusMarkdown(status);
      } else {
        textContent = JSON.stringify(status, null, 2);
      }

      return {
        content: [{ type: "text", text: textContent }],
        structuredContent: status,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Turn device on
server.registerTool(
  "wyze_turn_on",
  {
    title: "Turn Device On",
    description: `Turn on a Wyze device (plug, light, switch, etc.).

Provide either the device MAC address or nickname.
Works with plugs, lights, switches, and other devices that support power control.

Examples:
- wyze_turn_on(device="Living Room Light")
- wyze_turn_on(device="Office Plug")`,
    inputSchema: PowerControlSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await setDevicePower(device.mac, device.product_model, true);

      return {
        content: [
          {
            type: "text",
            text: `Successfully turned on "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Turn device off
server.registerTool(
  "wyze_turn_off",
  {
    title: "Turn Device Off",
    description: `Turn off a Wyze device (plug, light, switch, etc.).

Provide either the device MAC address or nickname.
Works with plugs, lights, switches, and other devices that support power control.

Examples:
- wyze_turn_off(device="Living Room Light")
- wyze_turn_off(device="Office Plug")`,
    inputSchema: PowerControlSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await setDevicePower(device.mac, device.product_model, false);

      return {
        content: [
          {
            type: "text",
            text: `Successfully turned off "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Set brightness
server.registerTool(
  "wyze_set_brightness",
  {
    title: "Set Light Brightness",
    description: `Set the brightness of a Wyze light/bulb.

Brightness value should be between 1 (dimmest) and 100 (brightest).
Only works with Wyze lights and bulbs.

Examples:
- wyze_set_brightness(device="Living Room Light", brightness=50)
- wyze_set_brightness(device="Bedroom Lamp", brightness=100)`,
    inputSchema: BrightnessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await setDeviceBrightness(device.mac, device.product_model, params.brightness);

      return {
        content: [
          {
            type: "text",
            text: `Successfully set brightness to ${params.brightness}% for "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Set color temperature
server.registerTool(
  "wyze_set_color_temp",
  {
    title: "Set Light Color Temperature",
    description: `Set the color temperature of a Wyze light/bulb.

Color temperature is specified in Kelvin:
- 2700K = Warm white (like incandescent)
- 4000K = Neutral white
- 6500K = Cool white (like daylight)

Only works with Wyze lights that support color temperature adjustment.

Examples:
- wyze_set_color_temp(device="Living Room Light", color_temp=2700)  # Warm
- wyze_set_color_temp(device="Office Light", color_temp=6500)  # Cool/daylight`,
    inputSchema: ColorTempSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await setDeviceColorTemp(device.mac, device.product_model, params.color_temp);

      return {
        content: [
          {
            type: "text",
            text: `Successfully set color temperature to ${params.color_temp}K for "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Set color (for color bulbs)
server.registerTool(
  "wyze_set_color",
  {
    title: "Set Light Color",
    description: `Set the color of a Wyze color bulb.

Color is specified as a 6-character hex RGB value (with or without # prefix).

Common colors:
- ff0000 = Red
- 00ff00 = Green
- 0000ff = Blue
- ffff00 = Yellow
- ff00ff = Magenta
- 00ffff = Cyan
- ffffff = White
- ffa500 = Orange

Only works with Wyze Color Bulbs (mesh bulbs).

Examples:
- wyze_set_color(device="Living Room Light", color="ff0000")  # Red
- wyze_set_color(device="Bedroom Lamp", color="#00ff00")  # Green`,
    inputSchema: ColorSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await setDeviceColor(device.mac, device.product_model, params.color);

      const colorDisplay = params.color.replace(/^#/, "").toUpperCase();
      return {
        content: [
          {
            type: "text",
            text: `Successfully set color to #${colorDisplay} for "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Lock
server.registerTool(
  "wyze_lock",
  {
    title: "Lock Door",
    description: `Lock a Wyze door lock.

Provide either the lock MAC address or nickname.
Only works with Wyze Lock devices.

Examples:
- wyze_lock(device="Front Door Lock")
- wyze_lock(device="ABC123DEF456")`,
    inputSchema: LockControlSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await controlLock(device.mac, device.product_model, "lock");

      return {
        content: [
          {
            type: "text",
            text: `Successfully locked "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Unlock
server.registerTool(
  "wyze_unlock",
  {
    title: "Unlock Door",
    description: `Unlock a Wyze door lock.

Provide either the lock MAC address or nickname.
Only works with Wyze Lock devices.

WARNING: This will remotely unlock your door. Use with caution.

Examples:
- wyze_unlock(device="Front Door Lock")
- wyze_unlock(device="ABC123DEF456")`,
    inputSchema: LockControlSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      await controlLock(device.mac, device.product_model, "unlock");

      return {
        content: [
          {
            type: "text",
            text: `Successfully unlocked "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Get lock info
server.registerTool(
  "wyze_get_lock_info",
  {
    title: "Get Lock Information",
    description: `Get detailed information about a Wyze lock.

Returns lock status, battery level, keypad info, and other details.
Only works with Wyze Lock devices.

Examples:
- wyze_get_lock_info(device="Front Door Lock")`,
    inputSchema: DeviceIdentifierSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      const lockInfo = await getLockInfo(device.mac);

      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines = [`# Lock: ${device.nickname}`, ""];
        for (const [key, value] of Object.entries(lockInfo)) {
          if (typeof value === "object") {
            lines.push(`## ${key}`);
            lines.push("```json");
            lines.push(JSON.stringify(value, null, 2));
            lines.push("```");
          } else {
            lines.push(`- **${key}**: ${value}`);
          }
        }
        textContent = lines.join("\n");
      } else {
        textContent = JSON.stringify(lockInfo, null, 2);
      }

      return {
        content: [{ type: "text", text: textContent }],
        structuredContent: lockInfo,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Run custom action
server.registerTool(
  "wyze_run_action",
  {
    title: "Run Device Action",
    description: `Run a custom action on a Wyze device.

This is a lower-level tool for running specific device actions.
Use this for actions not covered by other tools (e.g., garage door trigger).

Common action keys:
- power_on / power_off - Power control
- garage_door_trigger - Toggle garage door

Examples:
- wyze_run_action(device="Garage Door", action_key="garage_door_trigger")`,
    inputSchema: RunActionSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const device = await findDevice(params.device);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Device "${params.device}" not found. Use wyze_list_devices to see available devices.`,
            },
          ],
          isError: true,
        };
      }

      const providerKey = params.provider_key || device.mac;
      await runDeviceAction(device.mac, providerKey, params.action_key);

      return {
        content: [
          {
            type: "text",
            text: `Successfully ran action "${params.action_key}" on "${device.nickname}" (${device.mac})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }],
        isError: true,
      };
    }
  }
);

// Main entry point
async function main(): Promise<void> {
  // Initialize auth from environment variables
  try {
    initAuthFromEnv();
  } catch (error) {
    console.error(
      `Configuration error: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("");
    console.error("Required environment variables:");
    console.error("  WYZE_EMAIL    - Your Wyze account email");
    console.error("  WYZE_PASSWORD - Your Wyze account password");
    console.error("  WYZE_API_KEY  - API key from developer-api-console.wyze.com");
    console.error("  WYZE_KEY_ID   - Key ID from developer-api-console.wyze.com");
    process.exit(1);
  }

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wyze MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
