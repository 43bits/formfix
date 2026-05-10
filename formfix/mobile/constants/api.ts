import { Platform } from 'react-native';

/**
 * Change HOST when running on a physical device:
 *   iOS Sim    → localhost
 *   Android Em → 10.0.2.2
 *   Real phone → your machine's LAN IP, e.g. 192.168.1.42
 */
const HOST = __DEV__
  ? Platform.OS === 'android'
    ? '10.86.146.166'
    : 'localhost'
  : 'YOUR_PROD_HOST';

const PORT = 8000;

export const HTTP_BASE = `http://${HOST}:${PORT}/api`;
export const WS_BASE   = `ws://${HOST}:${PORT}/api`;