import { app } from 'electron';
import { Sequelize, Model, CreationOptional, DataTypes } from 'sequelize';

const sequelize = new Sequelize('database', '', 'Rently123', {
  dialect: 'sqlite',
  storage: `${app.getPath('appData')}/Rently/V4 Tester/sqlite.db`,
  dialectModulePath: '@journeyapps/sqlcipher',
});

export class Lock extends Model {
  declare id: CreationOptional<number>;

  declare lockMac: CreationOptional<string>;

  declare imei: CreationOptional<string>;

  declare provisioning: CreationOptional<string>;
}

Lock.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    lockMac: {
      type: new DataTypes.STRING(17),
      allowNull: true,
    },
    imei: {
      type: new DataTypes.STRING(15),
      allowNull: true,
    },
    provisioning: {
      type: new DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: 'lock',
    sequelize,
  }
);

export const setup = async () => {
  try {
    await Lock.sync();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};
