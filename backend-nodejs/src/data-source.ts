import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
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
import { ClientLog } from "./entities/ClientLog";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306");
const DB_USERNAME = process.env.DB_USERNAME || "bsk_user";
const DB_PASSWORD = process.env.DB_PASSWORD || "et_sikkert_passord";
const DB_DATABASE = process.env.DB_DATABASE || "bsk_service_db";
const NODE_ENV = process.env.NODE_ENV || 'development';
// DB_SYNC styrer TypeORM synchronize. Hvis satt, brukes verdien (true/false). Hvis ikke satt,
// er default: true i ikke-produksjon, false i produksjon.
const DB_SYNC_RAW = process.env.DB_SYNC;
const DB_SYNC_ENV = (DB_SYNC_RAW ?? '').toLowerCase() === 'true';
const HAS_DB_SYNC = typeof DB_SYNC_RAW !== 'undefined';
const isTsRuntime = __filename.endsWith('.ts');

export const AppDataSource = new DataSource({
  type: "mysql",
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  // Synchronize: hvis DB_SYNC er satt, bruk den eksplisitt; ellers default (true i dev, false i prod)
  synchronize: HAS_DB_SYNC ? DB_SYNC_ENV : (NODE_ENV !== 'production'),
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
  ClientLog,
  ],
  // Use TS migrations when running via tsx, else compiled JS from dist
  migrations: [ isTsRuntime ? 'src/migrations/*.ts' : path.join(__dirname, 'migrations', '*.js') ],
  subscribers: [],
});
