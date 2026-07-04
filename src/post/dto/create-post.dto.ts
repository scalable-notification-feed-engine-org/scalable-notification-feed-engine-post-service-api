import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Author } from './author';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;
  @IsString()
  @IsNotEmpty()
  author: Author;
  @IsString()
  @IsNotEmpty()
  tenantId: string;
  @IsString()
  @IsOptional()
  mediaUrl: string[];
}
