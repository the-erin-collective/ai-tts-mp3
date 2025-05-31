import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatFileSize',
  standalone: true,
})
export class FormatFileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined, decimalPlaces = 1): string {
    if (bytes === null || bytes === undefined || bytes < 0) {
      return '';
    }

    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(decimalPlaces));

    return formattedSize + ' ' + sizes[i];
  }
} 