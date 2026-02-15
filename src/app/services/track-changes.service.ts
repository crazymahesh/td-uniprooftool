import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface TrackedChange {
    id: string;
    type: 'insert' | 'delete';
    content: string;
    author: string;
    timestamp: Date;
    from: number;
    to: number;
}

@Injectable({
    providedIn: 'root'
})
export class TrackChangesService {
    private changesSource = new BehaviorSubject<TrackedChange[]>([]);
    changes$ = this.changesSource.asObservable();

    private changes: TrackedChange[] = [];

    addChange(change: Omit<TrackedChange, 'id' | 'timestamp' | 'author'>) {
        const newChange: TrackedChange = {
            ...change,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            author: 'Author' // In a real app, this would come from an auth service
        };
        this.changes.push(newChange);
        this.changesSource.next([...this.changes]);
        return newChange.id;
    }

    removeChange(id: string) {
        this.changes = this.changes.filter(c => c.id !== id);
        this.changesSource.next([...this.changes]);
    }

    clearChanges() {
        this.changes = [];
        this.changesSource.next([]);
    }

    private acceptChangeSource = new Subject<string>();
    acceptChange$ = this.acceptChangeSource.asObservable();

    private rejectChangeSource = new Subject<string>();
    rejectChange$ = this.rejectChangeSource.asObservable();

    acceptChange(id: string) {
        this.acceptChangeSource.next(id);
    }

    rejectChange(id: string) {
        this.rejectChangeSource.next(id);
    }

    updateChanges(newChanges: TrackedChange[]) {
        this.changes = newChanges;
        this.changesSource.next([...this.changes]);
    }
}
