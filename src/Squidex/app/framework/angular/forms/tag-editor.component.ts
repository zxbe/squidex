/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { Component, ElementRef, forwardRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';

import { Types } from '@app/framework/internal';

const KEY_COMMA = 188;
const KEY_DELETE = 8;
const KEY_ENTER = 13;
const KEY_UP = 38;
const KEY_DOWN = 40;

export interface Converter {
    convert(input: string): any;

    isValidInput(input: string): boolean;
    isValidValue(value: any): boolean;
}

export class IntConverter implements Converter {
    public isValidInput(input: string): boolean {
        return !!parseInt(input, 10) || input === '0';
    }

    public isValidValue(value: any): boolean {
        return Types.isNumber(value);
    }

    public convert(input: string): any {
        return parseInt(input, 10) || 0;
    }
}

export class FloatConverter implements Converter {
    public isValidInput(input: string): boolean {
        return !!parseFloat(input) || input === '0';
    }

    public isValidValue(value: any): boolean {
        return Types.isNumber(value);
    }

    public convert(input: string): any {
        return parseFloat(input) || 0;
    }
}

export class StringConverter implements Converter {
    public isValidInput(input: string): boolean {
        return input.trim().length > 0;
    }

    public isValidValue(value: any): boolean {
        return Types.isString(value);
    }

    public convert(input: string): any {
        return input.trim();
    }
}

export const SQX_TAG_EDITOR_CONTROL_VALUE_ACCESSOR: any = {
    provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagEditorComponent), multi: true
};

@Component({
    selector: 'sqx-tag-editor',
    styleUrls: ['./tag-editor.component.scss'],
    templateUrl: './tag-editor.component.html',
    providers: [SQX_TAG_EDITOR_CONTROL_VALUE_ACCESSOR]
})
export class TagEditorComponent implements ControlValueAccessor, OnDestroy, OnInit {
    private subscription: Subscription;
    private callChange = (v: any) => { /* NOOP */ };
    private callTouched = () => { /* NOOP */ };

    @Input()
    public converter: Converter = new StringConverter();

    @Input()
    public undefinedWhenEmpty = true;

    @Input()
    public acceptEnter = false;

    @Input()
    public allowDuplicates = true;

    @Input()
    public suggestions: string[] = [];

    @Input()
    public class: string;

    @Input()
    public placeholder = 'Press comma (,) to add tag';

    @Input()
    public inputName = 'tag-editor';

    @ViewChild('input')
    public inputElement: ElementRef;

    public hasFocus = false;

    public suggestedItems: string[] = [];
    public suggestedIndex = 0;

    public items: any[] = [];

    public addInput = new FormControl();

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public ngOnInit() {
        this.subscription =
            this.addInput.valueChanges.pipe(
                    tap(() => {
                        this.adjustSize();
                    }),
                    map(query => <string>query),
                    map(query => query ? query.trim() : query),
                    tap(query => {
                        if (!query) {
                            this.resetAutocompletion();
                        }
                    }),
                    distinctUntilChanged(),
                    map(query => {
                        if (Types.isArray(this.suggestions) && query && query.length > 0) {
                            return this.suggestions.filter(s => s.indexOf(query) >= 0 && this.items.indexOf(s) < 0);
                        } else {
                            return [];
                        }
                    }))
                .subscribe(items => {
                    this.suggestedIndex = -1;
                    this.suggestedItems = items || [];
                });
    }

    public writeValue(obj: any) {
        this.resetForm();

        if (this.converter && Types.isArrayOf(obj, v => this.converter.isValidValue(v))) {
            this.items = obj;
        } else {
            this.items = [];
        }
    }

    public setDisabledState(isDisabled: boolean): void {
        if (isDisabled) {
            this.addInput.disable();
        } else {
            this.addInput.enable();
        }
    }

    public registerOnChange(fn: any) {
        this.callChange = fn;
    }

    public registerOnTouched(fn: any) {
        this.callTouched = fn;
    }

    public focus() {
        if (this.addInput.enabled) {
            this.hasFocus = true;
        }
    }

    public markTouched() {
        this.callTouched();

        this.hasFocus = false;
    }

    public remove(index: number) {
        this.updateItems([...this.items.slice(0, index), ...this.items.splice(index + 1)]);
    }

    public adjustSize() {
        const style = window.getComputedStyle(this.inputElement.nativeElement);

        if (!canvas) {
            canvas = document.createElement('canvas');
        }

        if (canvas) {
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.font = `${style.getPropertyValue('font-size')} ${style.getPropertyValue('font-family')}`;

                this.inputElement.nativeElement.style.width = <any>((ctx.measureText(this.inputElement.nativeElement.value).width + 20) + 'px');
            }
        }
    }

    public onKeyDown(event: KeyboardEvent) {
        const key = event.keyCode;

        if (key === KEY_COMMA) {
            if (this.selectValue(this.addInput.value)) {
                return false;
            }
        } else if (key === KEY_DELETE) {
            const value = <string>this.addInput.value;

            if (!value || value.length === 0) {
                this.updateItems(this.items.slice(0, this.items.length - 1));

                return false;
            }
        } else if (key === KEY_UP) {
            this.up();
            return false;
        } else if (key === KEY_DOWN) {
            this.down();
            return false;
        } else if (key === KEY_ENTER) {
            if (this.suggestedIndex >= 0) {
                if (this.selectValue(this.suggestedItems[this.suggestedIndex])) {
                    return false;
                }
            } else if (this.acceptEnter) {
                if (this.selectValue(this.addInput.value)) {
                    return false;
                }
            }
        }

        return true;
    }

    public selectValue(value: string) {
        if (value && this.converter.isValidInput(value)) {
            const converted = this.converter.convert(value);

            if (this.allowDuplicates || this.items.indexOf(converted) < 0) {
                this.updateItems([...this.items, converted]);
            }

            this.resetForm();
            this.resetAutocompletion();
            return true;
        }
    }

    private resetAutocompletion() {
        this.suggestedItems = [];
        this.suggestedIndex = -1;
    }

    public selectIndex(selection: number) {
        if (selection < 0) {
            selection = 0;
        }

        if (selection >= this.items.length) {
            selection = this.items.length - 1;
        }

        this.suggestedIndex = selection;
    }

    private resetForm() {
        this.addInput.reset();
    }

    private up() {
        this.selectIndex(this.suggestedIndex - 1);
    }

    private down() {
        this.selectIndex(this.suggestedIndex + 1);
    }

    private updateItems(items: any[]) {
        this.items = items;

        if (items.length === 0 && this.undefinedWhenEmpty) {
            this.callChange(undefined);
        } else {
            this.callChange(this.items);
        }
    }
}

let canvas: HTMLCanvasElement | null = null;