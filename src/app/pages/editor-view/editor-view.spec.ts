import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorView } from './editor-view';

describe('EditorView', () => {
  let component: EditorView;
  let fixture: ComponentFixture<EditorView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditorView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
