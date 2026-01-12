// Wyze API Types

export interface WyzeCredentials {
  email: string;
  password: string;
  apiKey: string;
  keyId: string;
}

export interface WyzeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface WyzeLoginResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  mfa_options?: string[];
  mfa_details?: Record<string, unknown>;
}

export interface WyzeApiResponse<T = unknown> {
  code: string | number;
  msg: string;
  data: T;
}

export interface WyzeDevice {
  mac: string;
  nickname: string;
  product_type: string;
  product_model: string;
  device_params: Record<string, unknown>;
  is_online: boolean;
  conn_state: number;
  push_switch: number;
  first_activation_ts: number;
  firmware_ver?: string;
  hardware_ver?: string;
  p2p_id?: string;
  p2p_type?: number;
  parent_device_mac?: string;
  parent_device_enr?: string;
  enr?: string;
  device_logo?: string;
  product_logo?: string;
}

export interface WyzeDeviceList {
  device_list: WyzeDevice[];
  device_group_list?: WyzeDeviceGroup[];
  device_sort_list?: WyzeDeviceSortItem[];
}

export interface WyzeDeviceGroup {
  group_id: string;
  group_name: string;
  device_list: WyzeDevice[];
}

export interface WyzeDeviceSortItem {
  mac: string;
  sort_index: number;
}

export interface WyzePropertyItem {
  pid: string;
  value: string;
  ts?: number;
}

export interface WyzePropertyList {
  property_list: WyzePropertyItem[];
}

// Device type constants
export const DeviceType = {
  CAMERA: "Camera",
  PLUG: "Plug",
  BULB: "Light",
  MESH_BULB: "MeshLight",
  LOCK: "Lock",
  CONTACT_SENSOR: "ContactSensor",
  MOTION_SENSOR: "MotionSensor",
  THERMOSTAT: "Thermostat",
  SWITCH: "Switch",
  VACUUM: "RobotVacuum",
  DOORBELL: "Doorbell",
  GARAGE: "GarageDoor",
  SPRINKLER: "Sprinkler",
  HMS: "HMS",
} as const;

export type DeviceTypeValue = (typeof DeviceType)[keyof typeof DeviceType];

// Simplified device info for API responses
export interface DeviceInfo {
  [key: string]: unknown;
  mac: string;
  nickname: string;
  product_type: string;
  product_model: string;
  is_online: boolean;
  firmware_ver?: string;
}

export interface DeviceStatus extends DeviceInfo {
  properties: Record<string, string>;
}
