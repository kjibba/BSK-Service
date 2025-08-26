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

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306");
const DB_USERNAME = process.env.DB_USERNAME || "bsk_user";
const DB_PASSWORD = process.env.DB_PASSWORD || "et_sikkert_passord";
const DB_DATABASE = process.env.DB_DATABASE || "bsk_service_db";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV !== "production",
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
  ],
  migrations: ["src/migrations/*.ts"],
  subscribers: [],
});
