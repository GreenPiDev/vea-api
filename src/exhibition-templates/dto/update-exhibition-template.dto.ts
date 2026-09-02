import { PartialType } from '@nestjs/mapped-types';
import { CreateExhibitionTemplateDto } from './create-exhibition-template.dto';

export class UpdateExhibitionTemplateDto extends PartialType(CreateExhibitionTemplateDto) {}
