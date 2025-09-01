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

  @Column({ name: "unit", type: "varchar", length: 20, nullable: true })
  unit?: string;

  @Column({ name: "batch_number", type: "varchar", length: 50, nullable: true })
  batchNumber?: string;

  @Column({ name: "risk_assessment", type: "text", nullable: true })
  riskAssessment?: string;

  @Column({ name: "approved_by", type: "int", nullable: true })
  approvedBy?: number;

  @Column({ name: "waste_handling", type: "text", nullable: true })
  wasteHandling?: string;

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
  unit: this.unit,
  batch_number: this.batchNumber,
  risk_assessment: this.riskAssessment,
  approved_by: this.approvedBy,
  waste_handling: this.wasteHandling,
    };
  }
}
