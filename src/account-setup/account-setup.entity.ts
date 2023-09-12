import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('account-setup')
export class AccountSetup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true})
  amoId: number;

  @Column({nullable: true})
  domain: string;

  @Column("text", { array: true })
  placeList: string[];
}
