import fs from 'fs';
import path from 'path';

const ALERTS_PATH = path.resolve(process.cwd(), 'data', 'alerts.log');

export function appendAlert(message: string): void {
  try {
    fs.mkdirSync(path.dirname(ALERTS_PATH), { recursive: true });
    fs.appendFileSync(ALERTS_PATH, '[' + new Date().toISOString() + '] ' + message + '\n');
  } catch (err: any) {
    console.error('[Alerts] Failed to write alert:', err.message);
  }
}