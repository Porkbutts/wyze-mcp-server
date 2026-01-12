// Wyze API Client
import crypto from "crypto";
import axios, { AxiosError } from "axios";
import {
  API_BASE_URL,
  LOCK_BASE_URL,
  APP_NAME,
  APP_VER,
  APP_VERSION,
  PHONE_ID,
  SC,
  SV,
  PHONE_SYSTEM_TYPE,
  FORD_APP_KEY,
  FORD_APP_SECRET,
  PropertyId,
  PropertyValue,
} from "./constants.js";
import { ensureValidToken } from "./auth.js";
import type {
  WyzeApiResponse,
  WyzeDevice,
  WyzeDeviceList,
  WyzePropertyList,
  DeviceInfo,
  DeviceStatus,
} from "./types.js";

// Standard request payload
function createBasePayload(accessToken: string): Record<string, unknown> {
  return {
    access_token: accessToken,
    app_name: APP_NAME,
    app_ver: APP_VER,
    app_version: APP_VERSION,
    phone_id: PHONE_ID,
    phone_system_type: PHONE_SYSTEM_TYPE,
    sc: SC,
    sv: SV,
    ts: Date.now(),
  };
}

// Ford signature for lock API
function createFordSignature(
  method: string,
  path: string,
  params: Record<string, string>,
  timestamp: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const signString = `${method.toUpperCase()}${path}${paramString}${FORD_APP_SECRET}`;
  return crypto.createHash("md5").update(signString).digest("hex");
}

// Handle API errors
export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown> | undefined;
      const msg = data?.msg ?? data?.message ?? "Unknown error";

      switch (status) {
        case 401:
          return "Error: Authentication failed. Please check your credentials.";
        case 403:
          return "Error: Access denied. You may not have permission for this operation.";
        case 404:
          return "Error: Resource not found. Please check the device MAC address.";
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return `Error: API request failed (${status}): ${msg}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    } else if (error.code === "ENOTFOUND") {
      return "Error: Unable to reach Wyze servers. Please check your internet connection.";
    }
    return `Error: Network error: ${error.message}`;
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

// Get list of all devices
export async function getDeviceList(): Promise<WyzeDevice[]> {
  const accessToken = await ensureValidToken();

  const response = await axios.post<WyzeApiResponse<WyzeDeviceList>>(
    `${API_BASE_URL}/app/v2/home_page/get_object_list`,
    createBasePayload(accessToken),
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to get device list: ${response.data.msg}`);
  }

  return response.data.data.device_list || [];
}

// Get device properties
export async function getDeviceProperties(
  deviceMac: string,
  deviceModel: string
): Promise<WyzePropertyList> {
  const accessToken = await ensureValidToken();

  const payload = {
    ...createBasePayload(accessToken),
    device_mac: deviceMac,
    device_model: deviceModel,
  };

  const response = await axios.post<WyzeApiResponse<WyzePropertyList>>(
    `${API_BASE_URL}/app/v2/device/get_property_list`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to get device properties: ${response.data.msg}`);
  }

  return response.data.data;
}

// Set device property
export async function setDeviceProperty(
  deviceMac: string,
  deviceModel: string,
  propertyId: string,
  propertyValue: string
): Promise<void> {
  const accessToken = await ensureValidToken();

  const payload = {
    ...createBasePayload(accessToken),
    device_mac: deviceMac,
    device_model: deviceModel,
    pid: propertyId,
    pvalue: propertyValue,
  };

  const response = await axios.post<WyzeApiResponse<unknown>>(
    `${API_BASE_URL}/app/v2/device/set_property`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to set property: ${response.data.msg}`);
  }
}

// Run device action
export async function runDeviceAction(
  instanceId: string,
  providerKey: string,
  actionKey: string,
  actionParams?: Record<string, unknown>
): Promise<void> {
  const accessToken = await ensureValidToken();

  const payload = {
    ...createBasePayload(accessToken),
    instance_id: instanceId,
    provider_key: providerKey,
    action_key: actionKey,
    action_params: actionParams || {},
  };

  const response = await axios.post<WyzeApiResponse<unknown>>(
    `${API_BASE_URL}/app/v2/auto/run_action`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to run action: ${response.data.msg}`);
  }
}

// Control lock
export async function controlLock(
  deviceMac: string,
  deviceModel: string,
  action: "lock" | "unlock"
): Promise<void> {
  const accessToken = await ensureValidToken();
  const timestamp = Date.now().toString();
  const path = "/openapi/lock/v1/control";

  const params: Record<string, string> = {
    access_token: accessToken,
    key: FORD_APP_KEY,
    timestamp,
    action,
    uuid: deviceMac,
  };

  const sign = createFordSignature("POST", path, params, timestamp);

  const response = await axios.post<WyzeApiResponse<unknown>>(
    `${LOCK_BASE_URL}${path}`,
    {
      ...params,
      sign,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to ${action} lock: ${response.data.msg}`);
  }
}

// Get lock info
export async function getLockInfo(deviceMac: string): Promise<Record<string, unknown>> {
  const accessToken = await ensureValidToken();
  const timestamp = Date.now().toString();
  const path = "/openapi/lock/v1/info";

  const params: Record<string, string> = {
    access_token: accessToken,
    key: FORD_APP_KEY,
    timestamp,
    uuid: deviceMac,
    with_keypad: "1",
  };

  const sign = createFordSignature("GET", path, params, timestamp);

  const response = await axios.get<WyzeApiResponse<Record<string, unknown>>>(
    `${LOCK_BASE_URL}${path}`,
    {
      params: { ...params, sign },
      timeout: 30000,
    }
  );

  if (response.data.code !== "1" && response.data.code !== 1) {
    throw new Error(`Failed to get lock info: ${response.data.msg}`);
  }

  return response.data.data;
}

// Helper: Turn device on/off
export async function setDevicePower(
  deviceMac: string,
  deviceModel: string,
  on: boolean
): Promise<void> {
  await setDeviceProperty(
    deviceMac,
    deviceModel,
    PropertyId.POWER,
    on ? PropertyValue.ON : PropertyValue.OFF
  );
}

// Helper: Set brightness (1-100)
export async function setDeviceBrightness(
  deviceMac: string,
  deviceModel: string,
  brightness: number
): Promise<void> {
  const value = Math.max(1, Math.min(100, Math.round(brightness)));
  await setDeviceProperty(deviceMac, deviceModel, PropertyId.BRIGHTNESS, value.toString());
}

// Helper: Set color temperature (2700-6500 Kelvin)
export async function setDeviceColorTemp(
  deviceMac: string,
  deviceModel: string,
  colorTemp: number
): Promise<void> {
  const value = Math.max(2700, Math.min(6500, Math.round(colorTemp)));
  await setDeviceProperty(deviceMac, deviceModel, PropertyId.COLOR_TEMP, value.toString());
}

// Find device by MAC or nickname
export async function findDevice(
  identifier: string
): Promise<WyzeDevice | null> {
  const devices = await getDeviceList();
  const searchLower = identifier.toLowerCase();

  return (
    devices.find(
      (d) =>
        d.mac.toLowerCase() === searchLower ||
        d.nickname.toLowerCase() === searchLower
    ) || null
  );
}

// Convert device to simplified info
export function toDeviceInfo(device: WyzeDevice): DeviceInfo {
  return {
    mac: device.mac,
    nickname: device.nickname,
    product_type: device.product_type,
    product_model: device.product_model,
    is_online: device.is_online,
    firmware_ver: device.firmware_ver,
  };
}

// Get device status with properties
export async function getDeviceStatus(device: WyzeDevice): Promise<DeviceStatus> {
  const properties: Record<string, string> = {};

  try {
    const props = await getDeviceProperties(device.mac, device.product_model);
    for (const prop of props.property_list || []) {
      properties[prop.pid] = prop.value;
    }
  } catch {
    // Some devices don't support property queries
  }

  return {
    ...toDeviceInfo(device),
    properties,
  };
}
