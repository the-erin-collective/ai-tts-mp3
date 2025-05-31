import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatDate',
  standalone: true,
})
export class FormatDatePipe implements PipeTransform {
  transform(value: string | number | Date | undefined | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return ''; // Invalid date
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 2592000) { // Less than 30 days (approx a month)
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else if (diffInSeconds < 31536000) { // Less than a year
       const months = Math.floor(diffInSeconds / 2592000); // Using 30 days as approx month
       return `${months}mo ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000); // Using 365 days as approx year
      return `${years}y ago`;
    }
  }
} 