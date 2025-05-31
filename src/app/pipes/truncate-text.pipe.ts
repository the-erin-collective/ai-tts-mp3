import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateText',
  standalone: true,
})
export class TruncateTextPipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength: number = 50): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value.length <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength) + '...';
  }
} 