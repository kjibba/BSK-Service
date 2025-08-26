import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { MaterialUsage } from "./MaterialUsage";

@Entity("materials")
export class Material {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string;

  @Column({ name: "material_type", type: "varchar", length: 100, nullable: true })
  materialType?: string;

  @Column({ name: "active_ingredient", type: "varchar", length: 100, nullable: true })
  activeIngredient?: string;

  @Column({ name: "standard_amount", type: "float", nullable: true })
  standardAmount?: number;

  @OneToMany(() => MaterialUsage, usage => usage.material, { cascade: true })
  usages!: MaterialUsage[];

  toDict() {
    return {
      id: this.id,
      name: this.name,
      material_type: this.materialType,
      active_ingredient: this.activeIngredient,
      standard_amount: this.standardAmount,
    };
  }
}
