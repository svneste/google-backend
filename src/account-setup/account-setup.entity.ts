import { OAuthField } from 'src/interfaces/oauth-field.interface';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('google')
export class AccountSetup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true})
  amoId: number;

  @Column({nullable: true})
  domain: string;

  @Column({ type: 'json' })
  oauth: OAuthField;
}
