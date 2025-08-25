import { Sequelize, DataTypes, Model } from 'sequelize';
const sequelize = new Sequelize(process.env.NETLIFY_DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false // Set to console.log to see SQL queries
});

// Device Model
class Device extends Model {}
Device.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  model_number: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  serial_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(200)
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  },
  installation_date: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  max_amperage: {
    type: DataTypes.FLOAT
  },
  evse_count: {
    type: DataTypes.INTEGER
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  sequelize,
  modelName: 'Device',
  tableName: 'devices',
  timestamps: false
});

// ConsumptionRecord Model
class ConsumptionRecord extends Model {}
ConsumptionRecord.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  kwh_consumption: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  sequelize,
  modelName: 'ConsumptionRecord',
  tableName: 'consumption_records',
  timestamps: false
});

// Invoice Model
class Invoice extends Model {}
Invoice.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  billing_period_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  billing_period_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  total_kwh: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  total_amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  pdf_path: {
    type: DataTypes.STRING(200)
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  sequelize,
  modelName: 'Invoice',
  tableName: 'invoices',
  timestamps: false
});

// Define relationships
Device.hasMany(ConsumptionRecord, { foreignKey: 'device_id', as: 'consumption_records' });
ConsumptionRecord.belongsTo(Device, { foreignKey: 'device_id' });

Device.hasMany(Invoice, { foreignKey: 'device_id', as: 'invoices' });
Invoice.belongsTo(Device, { foreignKey: 'device_id' });

export {Device, ConsumptionRecord, Invoice};
