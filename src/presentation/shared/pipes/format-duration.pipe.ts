import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatDuration',
  standalone: true,
})
export class FormatDurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || seconds < 0) {
      return '-'; // Display hyphen for unavailable or invalid duration
    }    // Round seconds to nearest integer
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
} 