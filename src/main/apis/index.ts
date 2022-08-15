import axios from 'axios';

const login = async () => {
  const { data } = await axios.post(
    'https://api.rentlyopensesame.com/oakslock/token/login',
    { clientId: 'rently', clientSecret: 'rentlySecret' }
  );
  if (data.success) {
    return data.token;
  }
  throw data.message;
};

const uploadCsr = async () => {};
