import sequelize from 'sequelize';

// eslint-disable-next-line import/prefer-default-export
export const lock = sequelize.define('lock', {
  id: {
    type: sequelize.INTEGER,
  },
  lockMac: {
    type: sequelize.STRING,
  },
  imei: {
    type: sequelize.STRING,
  },
  provisioning: {
    type: sequelize.STRING,
  },
});
