import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";
import { Customer } from "./Customer";
import { EquipmentType } from "./EquipmentType";
import { ServiceLog } from "./ServiceLog";
import { formatEuropeanDate } from "../utils/dateUtils";

@Entity("equipment")
export class Equipment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "customer_id", type: "int", nullable: false })
  @Index()
  customerId!: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  type?: string;

  @Column({  name: "equipment_type_id", type: "int", nullable: true })
  @Index()
  equipmentTypeId?: number;

  @Column({ name: "serial_number", type: "varchar", length: 100, nullable: true })
  serialNumber?: string;

  @Column({ name: "installed_at", type: "date", nullable: true })
  installedAt?: Date;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ type: "float", nullable: true })
  latitude?: number;

  @Column({ type: "float", nullable: true })
  longitude?: number;

  @Column({ type: "json", nullable: true })
  properties?: any;

  // Relationships
  @ManyToOne(() => Customer, customer => customer.equipment)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer;

  @ManyToOne(() => EquipmentType)
  @JoinColumn({ name: "equipment_type_id" })
  equipmentType?: EquipmentType;

  @OneToMany(() => ServiceLog, serviceLog => serviceLog.equipmentItem, { cascade: true })
  serviceLogs!: ServiceLog[];

  toDict() {
    return {
      id: this.id,
      customer_id: this.customerId,
      name: this.name,
      type: this.type,
      equipment_type_id: this.equipmentTypeId,
      serial_number: this.serialNumber,
      installed_at: formatEuropeanDate(this.installedAt),
      notes: this.notes,
      latitude: this.latitude,
      longitude: this.longitude,
      properties: this.properties,
    };
  }
}
