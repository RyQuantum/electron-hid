/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { BrowserWindow, dialog } from 'electron';
import crc from 'crc';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export const paddingZeroAndCrc16 = (arr: number[]): number[] => {
  let num = Math.floor(arr.length / 64);
  if (num * 64 < arr.length) num += 1;
  const length = num * 64 - 2;
  const payload: number[] = [
    90,
    90,
    Math.floor(length / 256),
    length % 256,
    ...arr,
    ...Array(num * 64 - arr.length - 6).fill(0),
  ];
  const data = payload.slice(2);
  const checksum = crc.crc16ccitt(Buffer.from(data));
  return [...payload, Math.floor(checksum / 256), checksum % 256];
};

export const generateDateTime2Buffer = (date: string, time: string): Buffer => {
  let dateArr = date.split('-').map((v) => parseInt(v, 10));
  if (dateArr[0] > 2063) dateArr = [2063, 15, 31];
  else if (dateArr[0] < 2000) dateArr = [2000, 0, 0];
  const timeArr = time.split(':').map((v) => parseInt(v, 10));

  const yr = (dateArr[0] - 2000).toString(2).padStart(6, '0').slice(-6);
  const mo = dateArr[1].toString(2).padStart(4, '0').slice(-4);
  const dy = dateArr[2].toString(2).padStart(5, '0').slice(-5);
  const hr = timeArr[0].toString(2).padStart(5, '0').slice(-5);
  const mi = timeArr[1].toString(2).padStart(6, '0').slice(-6);
  const sc = timeArr[2].toString(2).padStart(6, '0').slice(-6);

  const dateTime = yr + mo + dy + hr + mi + sc;
  const hexString = parseInt(dateTime, 2).toString(16).padStart(8, '0');
  return Buffer.from(hexString, 'hex');
};

export function alert(type: string, message: string) {
  const title = type[0].toUpperCase() + type.slice(1);
  dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type,
      title,
      message,
    }
  );
}
