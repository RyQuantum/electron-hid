import axios from 'axios';
import FormData from 'form-data';

let accessToken: string | null = null;

export const login = async () => {
  const { data } = await axios.post(
    'https://api.rentlyopensesame.com/oakslock/token/login',
    { clientId: 'rently', clientSecret: 'rentlySecret' }
  );
  if (data.success) {
    accessToken = data.token.accessToken;
    console.log('accessToken:', accessToken);
    return data.token;
  }
  throw data.message;
};

export const uploadCsr = async (lockMac: string, imei: string, csr: string) => {
  const formData = new FormData();
  formData.append('file', csr, 'client.csr');
  const { data } = await axios.post(
    'https://api.rentlyopensesame.com/oakslock/device/addLockToDMS',
    formData,
    {
      params: {
        deviceId: lockMac.split(':').slice(2).join(''),
        deviceMac: lockMac,
        imei,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (data.success) {
    return data.certificate;
  }
  throw data.message;
};
