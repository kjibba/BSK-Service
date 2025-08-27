import "reflect-metadata";
import { DataSource } from "typeorm";
import { Customer } from "./entities/Customer";
import { Visit } from "./entities/Visit";
import { Equipment } from "./entities/Equipment";
import { EquipmentType } from "./entities/EquipmentType";
import { ServiceLog } from "./entities/ServiceLog";
import { Material } from "./entities/Material";
import { MaterialUsage } from "./entities/MaterialUsage";
import { Employee } from "./entities/Employee";
import { RouteChoice } from "./entities/RouteChoice";
import { Photo } from "./entities/Photo";
import { Feedback } from "./entities/Feedback";
import { DailyTask } from "./entities/DailyTask";
import { ServiceReport } from "./entities/ServiceReport";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306");
const DB_USERNAME = process.env.DB_USERNAME || "bsk_user";
const DB_PASSWORD = process.env.DB_PASSWORD || "et_sikkert_passord";
const DB_DATABASE = process.env.DB_DATABASE || "bsk_service_db";
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_SYNC = (process.env.DB_SYNC || '').toLowerCase() === 'true';

export const AppDataSource = new DataSource({
  type: "mysql",
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  // In production: always false. Locally, you can set DB_SYNC=true in .env to auto-create tables.
  synchronize: NODE_ENV === 'production' ? false : (DB_SYNC || true),
  logging: NODE_ENV !== "production",
  entities: [
    Customer,
    Visit,
    Equipment,
    EquipmentType,
    ServiceLog,
    Material,
    MaterialUsage,
    Employee,
    RouteChoice,
    Photo,
    Feedback,
    DailyTask,
  ServiceReport,
  ],
  migrations: [process.env.NODE_ENV === 'production' ? "dist/migrations/*.js" : "src/migrations/*.ts"],
  subscribers: [],
});
