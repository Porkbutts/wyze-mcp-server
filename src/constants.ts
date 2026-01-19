// Wyze API Constants

// Base URLs
export const AUTH_BASE_URL = "https://auth-prod.api.wyze.com";
export const API_BASE_URL = "https://api.wyzecam.com";
export const LOCK_BASE_URL = "https://yd-saas-toc.wyzecam.com";
export const IOT_BASE_URL = "https://wyze-sirius-service.wyzecam.com";

// Auth API key (constant from Wyze app)
export const AUTH_API_KEY = "WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ";

// App identification
export const APP_INFO = "wyze_android_2.19.14";
export const APP_NAME = "com.hualai.WyzeCam";
export const APP_VER = "wyze_developer_api";
export const APP_VERSION = "wyze_developer_api";
export const PHONE_ID = "wyze_developer_api";
export const SC = "wyze_developer_api";
export const SV = "wyze_developer_api";
export const PHONE_SYSTEM_TYPE = "1";

// Ford API keys (for lock control)
export const FORD_APP_KEY = "275965684684dbdaf29a0ed9";
export const FORD_APP_SECRET = "4deekof1ba311c5c33a9cb8e12787e8c";

// Olive API keys (for IoT devices)
export const OLIVE_SIGNING_SECRET = "wyze_app_secret_key_132";
export const OLIVE_APP_ID = "9319141212m2ik";

// Token expiry (48 hours in milliseconds)
export const TOKEN_REFRESH_INTERVAL = 48 * 60 * 60 * 1000;

// Response character limit
export const CHARACTER_LIMIT = 25000;

// Property IDs
export const PropertyId = {
  NOTIFICATION: "P1",
  POWER: "P3",
  AVAILABLE: "P5",
  BRIGHTNESS: "P1501",
  COLOR_TEMP: "P1502",
  COLOR: "P1507",
  CONTROL_MODE: "P1508",
  CAMERA_SIREN: "P1049",
  FLOOD_LIGHT: "P1056",
  MOTION_DETECTION: "P1001",
  MOTION_RECORDING: "P1047",
  SOUND_NOTIFICATION: "P1048",
} as const;

// Light control modes (for P1508)
export const LightControlMode = {
  COLOR: "1",
  TEMPERATURE: "2",
  FRAGMENTED: "3",
} as const;

// Property values
export const PropertyValue = {
  ON: "1",
  OFF: "0",
} as const;
