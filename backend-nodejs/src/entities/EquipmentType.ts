import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { formatEuropeanDateTime } from "../utils/dateUtils";

@Entity("equipment_types")
export class EquipmentType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false, unique: true })
  name!: string;

  @Column({ type: "json", nullable: true })
  fields?: any;

  @Column({ name: "created_at", type: "datetime", nullable: true })
  createdAt?: Date;

  toDict() {
    return {
      id: this.id,
      name: this.name,
      fields: this.fields,
      created_at: formatEuropeanDateTime(this.createdAt),
    };
  }
}
