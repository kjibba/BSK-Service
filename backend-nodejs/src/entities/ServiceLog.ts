import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";
import { Visit } from "./Visit";
import { Equipment } from "./Equipment";
import { MaterialUsage } from "./MaterialUsage";
import { formatEuropeanDateTime } from "../utils/dateUtils";

@Entity("service_logs")
export class ServiceLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "visit_id", type: "int", nullable: false })
  @Index()
  visitId!: number;

  @Column({  name: "equipment_id", type: "int", nullable: false })
  @Index()
  equipmentId!: number;

  @Column({ name: "log_date", type: "datetime", nullable: true })
  logDate?: Date;

  @Column({ type: "text", nullable: false })
  description!: string;

  @Column({ name: "hours_worked", type: "float", nullable: true })
  hoursWorked?: number;

  // Relationships
  @ManyToOne(() => Visit, visit => visit.serviceLogs)
  @JoinColumn({ name: "visit_id" })
  visit!: Visit;

  @ManyToOne(() => Equipment, equipment => equipment.serviceLogs)
  @JoinColumn({ name: "equipment_id" })
  equipmentItem!: Equipment;

  @OneToMany(() => MaterialUsage, materialUsage => materialUsage.serviceLog, { cascade: true })
  materialsUsed!: MaterialUsage[];

  toDict() {
    const obj: any = {
      id: this.id,
      visit_id: this.visitId,
      equipment_id: this.equipmentId,
      log_date: formatEuropeanDateTime(this.logDate),
      description: this.description,
      hours_worked: this.hoursWorked,
    };

    // Include material usages if loaded
    if (this.materialsUsed) {
      obj.materials_used = this.materialsUsed.map(usage => {
        const item: any = usage.toDict();
        if (usage.material) {
          item.material = {
            id: usage.material.id,
            name: usage.material.name,
            material_type: usage.material.materialType,
            active_ingredient: usage.material.activeIngredient,
            standard_amount: usage.material.standardAmount,
          };
        }
        return item;
      });
    }

    return obj;
  }
}
