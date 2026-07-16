import 'reflect-metadata';
import { ProductFamily, TruckZoneType } from '@camiones/shared';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/**
 * loading-agent-llm Phase 2 — class-validator gate for a raw ConstraintSet
 * JSON payload returned by `AgentPort.planConstraints`. Structurally mirrors
 * `@camiones/shared`'s `ConstraintSet`/`HardRule` union; kept in the API
 * layer (not in `packages/shared`) so class-validator/class-transformer
 * never ship in the `apps/web` bundle.
 */

export class StackingProhibitionRuleDto {
  @IsIn(['STACKING_PROHIBITION'])
  type!: 'STACKING_PROHIBITION';

  @IsString()
  productCode!: string;
}

export class FragileOnTopRuleDto {
  @IsIn(['FRAGILE_ON_TOP'])
  type!: 'FRAGILE_ON_TOP';

  @IsString()
  productCode!: string;
}

export class ZoneRestrictionRuleDto {
  @IsIn(['ZONE_RESTRICTION'])
  type!: 'ZONE_RESTRICTION';

  @IsString()
  productCode!: string;

  @IsIn(Object.values(TruckZoneType))
  zone!: TruckZoneType;
}

export class TierRestrictionRuleDto {
  @IsIn(['TIER_RESTRICTION'])
  type!: 'TIER_RESTRICTION';

  @IsString()
  productCode!: string;

  @IsInt()
  @Min(1)
  maxTier!: number;
}

export class FamilyPlacementBanRuleDto {
  @IsIn(['FAMILY_PLACEMENT_BAN'])
  type!: 'FAMILY_PLACEMENT_BAN';

  @IsIn(Object.values(ProductFamily))
  family!: ProductFamily;

  @IsIn(Object.values(TruckZoneType))
  zone!: TruckZoneType;
}

export type HardRuleDto = StackingProhibitionRuleDto | FragileOnTopRuleDto | ZoneRestrictionRuleDto | TierRestrictionRuleDto | FamilyPlacementBanRuleDto;

export class ConstraintSetDto {
  @IsIn([1])
  version!: 1;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: StackingProhibitionRuleDto, name: 'STACKING_PROHIBITION' },
        { value: FragileOnTopRuleDto, name: 'FRAGILE_ON_TOP' },
        { value: ZoneRestrictionRuleDto, name: 'ZONE_RESTRICTION' },
        { value: TierRestrictionRuleDto, name: 'TIER_RESTRICTION' },
        { value: FamilyPlacementBanRuleDto, name: 'FAMILY_PLACEMENT_BAN' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  hardRules!: HardRuleDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
