import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'C:\\Users\\Ryan\\AppData\\Roaming\\Rently\\sqlite.db',
});

export const Lock = sequelize.define('lock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  lockMac: {
    type: DataTypes.STRING,
  },
  imei: {
    type: DataTypes.STRING,
  },
  provisioning: {
    type: DataTypes.STRING,
  },
});

export const setupDB = async () => {
  try {
    // await sequelize.authenticate();
    await Lock.sync();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

export default sequelize;
