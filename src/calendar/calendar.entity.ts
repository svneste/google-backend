import { OAuthField } from 'src/interfaces/oauth-field.interface';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Calendar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clientId: number;

  @Column({ type: 'json' })
  oauth: OAuthField;
}