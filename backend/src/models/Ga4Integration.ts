import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Organization from './Organization';

interface Ga4IntegrationAttributes {
  id: string;
  organization_id: string;
  property_id: string;
  measurement_id?: string | null;
  service_account_email: string;
  service_account_key_encrypted: string;
  is_active: boolean;
  last_tested_at?: Date | null;
  last_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface Ga4IntegrationCreationAttributes
  extends Optional<
    Ga4IntegrationAttributes,
    | 'id'
    | 'measurement_id'
    | 'is_active'
    | 'last_tested_at'
    | 'last_error'
    | 'created_at'
    | 'updated_at'
  > {}

class Ga4Integration
  extends Model<Ga4IntegrationAttributes, Ga4IntegrationCreationAttributes>
  implements Ga4IntegrationAttributes
{
  public id!: string;
  public organization_id!: string;
  public property_id!: string;
  public measurement_id!: string | null;
  public service_account_email!: string;
  public service_account_key_encrypted!: string;
  public is_active!: boolean;
  public last_tested_at!: Date | null;
  public last_error!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  public organization?: Organization;
}

Ga4Integration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    property_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    measurement_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    service_account_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    service_account_key_encrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_tested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ga4_integrations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Ga4Integration;
