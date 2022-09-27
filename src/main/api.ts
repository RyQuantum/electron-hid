import { WebContents } from 'electron';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';

let accessToken: string | null;
let deviceToken: string | null;
let rootCA: string | null;

const URL = 'https://api.rentlyopensesame.com/oakslock/';
// const URL = 'http://192.168.2.8:3000/oakslock/';

const interceptRequest = async ({
  method,
  url,
  headers = {},
  params = {},
  ...rest
}: AxiosRequestConfig) => {
  const config = {
    url,
    method,
    params,
    headers,
    ...rest,
  };
  console.log(
    `---- req:[${method}]:(${
      config.baseURL || ''
    }${url}) params:${JSON.stringify(params)} data:${
      rest.data instanceof URLSearchParams
        ? rest.data.toString()
        : JSON.stringify(rest.data)
    }`
  );
  return config;
};

const interceptResponse = async ({ data, config, ...rest }: AxiosResponse) => {
  console.log(
    `---- res:[${config.method}]:(${config.url}) ${JSON.stringify(data)}`
  );
  return { data, config, ...rest };
};

axios.interceptors.request.use(interceptRequest);
axios.interceptors.response.use(interceptResponse);

export const login = async () => {
  const { data } = await axios.post(`${URL}token/login`, {
    clientId: 'rently',
    clientSecret: 'rentlySecret',
  });
  if (data.success) {
    accessToken = data.token.accessToken;
    return;
  }
  throw new Error(data.message);
};

export const getDeviceToken = async (lockMac: string) => {
  const { data } = await axios.get(
    `${URL}token/getDeviceJwtToken?deviceMac=${lockMac}&role=ADMIN`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (data.success) {
    deviceToken = data.token.accessToken;
    return;
  }
  throw new Error(data.message);
};

export const load = async (path: string) => {
  rootCA = (await fs.readFile(path)).toString();
};

export type CertificateObj = {
  certificate: string;
  privateKey: string;
  deviceCA: string;
  rootCA: string;
};

export const uploadCsr = async (
  lockMac: string,
  imei: string,
  csr: string
): Promise<CertificateObj> => {
  const formData = new FormData();
  formData.append('file', csr, 'client.csr');
  const { data } = await axios.post(`${URL}device/addLockToDMS`, formData, {
    params: {
      deviceId: lockMac.split(':').slice(2).join(''),
      deviceMac: lockMac,
      imei,
      lockType: 'V4Panel',
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (data.success) {
    return {
      certificate: data.certificate.certificate,
      privateKey: data.iot_certificate.privateKey,
      deviceCA: data.iot_certificate.certificatePem,
      rootCA: rootCA!,
    };
  }
  throw new Error(data.message);
};

export const requestServerCommand = async (
  lockMac: string,
  operation: string,
  bleResponse?: string,
  parameters?: object
): Promise<{ success: boolean; command?: string }> => {
  const url = `${URL}device/bleCommand?`;
  let params: { command: string; lockMac: string; response?: string } = {
    command: operation,
    lockMac,
  };
  if (bleResponse) params.response = bleResponse;
  if (parameters) params = { ...params, ...parameters };
  const { data } = await axios({
    method: 'get',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${deviceToken}`,
    },
    url,
    params,
  });
  return data;
};

export const forwardResponseToServer = async (
  lockMac: string,
  bleResponse: string,
  parameters?: object
): Promise<{ success: boolean; command?: string }> => {
  const url = `${URL}device/bleCommandResponse?`;
  const params = { lockMac };
  const data = new URLSearchParams({ response: bleResponse, ...parameters });
  const res = await axios({
    method: 'post',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${deviceToken}`,
    },
    url,
    params,
    data,
  });
  return res.data;
};
