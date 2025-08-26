import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Visit } from "./Visit";

@Entity("photos")
export class Photo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "visit_id", type: "int", nullable: true })
  @Index()
  visitId?: number;

  @Column({ name: "image_url", type: "text", nullable: true })
  imageUrl?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @ManyToOne(() => Visit, visit => visit.photos)
  @JoinColumn({ name: "visit_id" })
  visit?: Visit;

  toDict() {
    return {
      id: this.id,
      visit_id: this.visitId,
      image_url: this.imageUrl,
      description: this.description,
    };
  }
}
