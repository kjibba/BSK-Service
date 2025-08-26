import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { ServiceLog } from "./ServiceLog";
import { Material } from "./Material";

@Entity("material_usage")
export class MaterialUsage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "service_log_id", type: "int", nullable: false })
  @Index()
  serviceLogId!: number;

  @Column({  name: "material_id", type: "int", nullable: false })
  @Index()
  materialId!: number;

  @Column({ type: "float", nullable: true })
  amount?: number;

  @ManyToOne(() => ServiceLog, serviceLog => serviceLog.materialsUsed)
  @JoinColumn({ name: "service_log_id" })
  serviceLog!: ServiceLog;

  @ManyToOne(() => Material, material => material.usages)
  @JoinColumn({ name: "material_id" })
  material!: Material;

  toDict() {
    return {
      id: this.id,
      service_log_id: this.serviceLogId,
      material_id: this.materialId,
      amount: this.amount,
    };
  }
}
