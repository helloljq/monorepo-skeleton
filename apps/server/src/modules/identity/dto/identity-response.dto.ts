import { ApiProperty } from "@nestjs/swagger";
import { IdentityProvider } from "@prisma/client";

export class IdentityItemDto {
  @ApiProperty({ description: "Identity ID" })
  id!: number;

  @ApiProperty({ description: "Identity provider", enum: IdentityProvider })
  provider!: IdentityProvider;

  @ApiProperty({ description: "Provider ID (masked for security)" })
  providerId!: string;

  @ApiProperty({ description: "Whether the identity is verified" })
  verified!: boolean;

  @ApiProperty({ description: "Creation time" })
  createdAt!: Date;
}

export class IdentityListResponseDto {
  @ApiProperty({
    type: IdentityItemDto,
    isArray: true,
    description: "List of identities",
  })
  identities!: IdentityItemDto[];
}

export class UnbindResponseDto {
  @ApiProperty({ description: "Success message" })
  message!: string;
}
