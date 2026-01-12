# Wyze MCP Server

An MCP (Model Context Protocol) server for controlling Wyze smart home devices. This server allows AI assistants to list, monitor, and control Wyze devices including cameras, plugs, lights, locks, thermostats, and more.

## Features

- **Device Discovery**: List all Wyze devices with filtering by type
- **Power Control**: Turn devices on/off (plugs, lights, switches)
- **Light Control**: Adjust brightness and color temperature
- **Lock Control**: Lock and unlock Wyze door locks
- **Status Monitoring**: Get detailed device status and properties
- **Custom Actions**: Run device-specific actions (garage door, etc.)

## Prerequisites

- Node.js 18 or higher
- A Wyze account with devices
- Wyze API credentials (get them at https://developer-api-console.wyze.com)

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your Wyze credentials as environment variables:

```bash
export WYZE_EMAIL="your-email@example.com"
export WYZE_PASSWORD="your-password"
export WYZE_API_KEY="your-api-key"
export WYZE_KEY_ID="your-key-id"
```

To get your API Key and Key ID:
1. Go to https://developer-api-console.wyze.com
2. Log in with your Wyze account
3. Create a new API key (only one key per account is allowed)
4. Note: API keys are valid for 1 year

## Usage with Claude Code

```bash
claude mcp add-json wyze '{
  "command": "node",
  "args": ["/path/to/wyze-mcp-server/dist/index.js"],
  "env": {
    "WYZE_EMAIL": "your-email@example.com",
    "WYZE_PASSWORD": "your-password",
    "WYZE_API_KEY": "your-api-key",
    "WYZE_KEY_ID": "your-key-id"
  }
}'
```

## Available Tools

### `wyze_list_devices`

List all Wyze devices on the account.

**Parameters:**
- `device_type` (optional): Filter by device type (e.g., `Camera`, `Light`, `Plug`, `Lock`)
- `response_format` (optional): `markdown` or `json` (default: `markdown`)

**Example:**
```
List all my Wyze lights
```

### `wyze_get_device_status`

Get detailed status and properties of a specific device.

**Parameters:**
- `device` (required): Device MAC address or nickname
- `response_format` (optional): `markdown` or `json` (default: `markdown`)

**Example:**
```
Get the status of my Living Room Light
```

### `wyze_turn_on`

Turn on a device (plug, light, switch).

**Parameters:**
- `device` (required): Device MAC address or nickname

**Example:**
```
Turn on the Office Plug
```

### `wyze_turn_off`

Turn off a device (plug, light, switch).

**Parameters:**
- `device` (required): Device MAC address or nickname

### `wyze_set_brightness`

Set the brightness of a Wyze light.

**Parameters:**
- `device` (required): Device MAC address or nickname
- `brightness` (required): Brightness level from 1 to 100

**Example:**
```
Set the bedroom light to 50% brightness
```

### `wyze_set_color_temp`

Set the color temperature of a Wyze light.

**Parameters:**
- `device` (required): Device MAC address or nickname
- `color_temp` (required): Color temperature in Kelvin (2700-6500)

**Example:**
```
Set the living room light to warm white (2700K)
```

### `wyze_lock`

Lock a Wyze door lock.

**Parameters:**
- `device` (required): Lock MAC address or nickname

### `wyze_unlock`

Unlock a Wyze door lock.

**Parameters:**
- `device` (required): Lock MAC address or nickname

### `wyze_get_lock_info`

Get detailed information about a Wyze lock including battery level and keypad info.

**Parameters:**
- `device` (required): Lock MAC address or nickname
- `response_format` (optional): `markdown` or `json` (default: `markdown`)

### `wyze_run_action`

Run a custom action on a device.

**Parameters:**
- `device` (required): Device MAC address or nickname
- `action_key` (required): Action to run (e.g., `garage_door_trigger`)
- `provider_key` (optional): Provider key (defaults to device MAC)

**Example:**
```
Trigger the garage door
```

## Supported Device Types

| Type | Description |
|------|-------------|
| Camera | Wyze Cam, Cam Pan, Doorbell |
| Plug | Wyze Plug, Outdoor Plug |
| Light | Wyze Bulb, Light Strip |
| MeshLight | Wyze Bulb (mesh network) |
| Lock | Wyze Lock |
| ContactSensor | Wyze Sense contact sensor |
| MotionSensor | Wyze Sense motion sensor |
| Thermostat | Wyze Thermostat |
| Switch | Wyze Switch |
| RobotVacuum | Wyze Robot Vacuum |
| GarageDoor | Wyze Garage Door Controller |
| Sprinkler | Wyze Sprinkler |

## Color Temperature Guide

| Kelvin | Description |
|--------|-------------|
| 2700K | Warm white (like incandescent) |
| 3000K | Soft white |
| 4000K | Neutral white |
| 5000K | Daylight |
| 6500K | Cool white (like daylight) |

## Notes

- Authentication is handled automatically; tokens refresh before expiry
- MFA/2FA is not currently supported; disable it or use an account without MFA
- Device operations may take a few seconds to complete
- Some devices (like cameras) have limited remote control capabilities

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Build
npm run build

# Run
npm start
```

## License

MIT
