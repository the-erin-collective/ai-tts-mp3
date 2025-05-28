import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  // Using Angular 20 signals for reactive state
  title = signal('Welcome to Angular 20 with Onion Architecture!');
  clickCount = signal(0);
  
  // Computed signal that derives from clickCount
  clickMessage = computed(() => {
    const count = this.clickCount();
    if (count === 0) {
      return 'Click the button to test Angular 20 signals!';
    } else if (count === 1) {
      return 'Great! You clicked once. Signals are working!';
    } else {
      return `Awesome! You've clicked ${count} times. Signals update automatically!`;
    }
  });

  // Array to demonstrate @for control flow
  features = signal([
    'Standalone Components',
    'Signals API', 
    'New Control Flow (@if, @for, @else)',
    'Onion Architecture',
    'Domain-Driven Design'
  ]);

  incrementClick() {
    this.clickCount.update(count => count + 1);
  }

  resetCount() {
    this.clickCount.set(0);
  }
}
