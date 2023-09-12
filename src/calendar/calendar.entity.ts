import { idEventField } from 'src/interfaces/event-field.interface copy';
import { OAuthField } from 'src/interfaces/oauth-field.interface';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('events')
export class Calendar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  idLead: number;

  @Column()
  leadName: string;

  @Column()
  responsible_user: string;

  @Column()
  status_id: string;

  @Column()
  pipeline_id: string;

  @Column()
  statusEvent: string;

  @Column()
  leadLink: string;

  @Column()
  dataStartEvent: string;

  @Column()
  dataEndEvent: string;

  @Column()
  nameEvent: string;

  @Column()
  formatEvent: string;

  @Column()
  numGuests: string;

  @Column("jsonb", {nullable: true})
  idEvent: string[];

  @Column("text", { array: true })
  placeEvent: string[];
}
