import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Ceramic Mug' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'MUG-100' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: '12.50', description: 'Decimal string' })
  @IsNumberString()
  price!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity!: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search name or sku' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
