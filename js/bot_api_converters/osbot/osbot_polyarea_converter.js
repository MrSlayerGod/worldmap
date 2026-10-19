'use strict';

import {PolyArea} from '../../model/PolyArea.js';
import {Position} from '../../model/Position.js';
import {OSBotConverter} from './osbot_converter.js';

export class OSBotPolyAreaConverter extends OSBotConverter {

    /*
    API Doc:
        https://osbot.org/api/org/osbot/rs07/api/map/Area.html
        
        Area(int[][] positions)
        Area(Position[] positions)
    */
    fromJava(text, polyarea) {
        polyarea.removeAll();
        text = text.replace(/\s/g, '');
        
        var zPattern = /.setPlane\(\d\)/mg;
        var zMatch = zPattern.exec(text);
        var z = zMatch ? zMatch[1] : 0;

        var positionsPattern = /\{(\d+),(\d+)\}/mg;
        var match;
        while ((match = positionsPattern.exec(text))) {
            polyarea.add(new Position(match[1], match[2], z));
        }
    }
    
    toRaw(polyarea) {
        var output = "";
        for (var i = 0; i < polyarea.positions.length; i++) {
            output += `${polyarea.positions[i].x},${polyarea.positions[i].y}\n`;
        }
        return output;
    }
    
    toJava(polyarea) {
        if (polyarea.positions.length == 0) {
            return "";
        }
        var output = `${this.javaArea} area = new ${this.javaArea}(\n    new int[][]{`;
        for (var i = 0; i < polyarea.positions.length; i++) {
            output += `\n        { ${polyarea.positions[i].x}, ${polyarea.positions[i].y} }`;
            if (i !== polyarea.positions.length - 1) {
                output += ",";
            }
        }
        output += "\n    }\n)";
        if (polyarea.positions.length > 0 && polyarea.positions[0].z > 0) {
            output += `.setPlane(${polyarea.positions[0].z})`;
        }
        output += ";";
        return output;
    }

    fromGroml(text, polyarea) {
        polyarea.removeAll();
        text = text.replaceAll(' ', '')
        var x = {}
        var y = {}
        var level = 0
        var lines = text.split("\n")
        for (let i = 0; i < lines.length; i++) {
            var line = lines[i]
            let value = line.split('=')[1];
            switch (line[0]) {
                case 'x':
                    x = this.parseNumberArray(value)
                    break;
                case 'y':
                    y = this.parseNumberArray(value)
                    break;
                case 'l':
                    level = parseFloat(value)
                    break;
            }
        }
        for (let i = 0; i < x.length; i++) {
            polyarea.add(new Position(x[i], y[i], level));
        }
    }

    parseNumberArray(str) {
        const numberArray = str
            .replace(/^\s*\[\s*|\s*\]\s*$/g, '')  // remove brackets and surrounding spaces
            .split(',')                            // trim spaces
            .filter(s => s.length > 0)            // skip empty strings
            .map(parseFloat);

        if (numberArray.some(isNaN)) {
            throw new Error("Invalid number in input string");
        }

        return numberArray;
    }

    toGroml(polyarea) {
        if (polyarea.positions.length == 0) {
            return "";
        }
        var output = `x = [`;
        for (var i = 0; i < polyarea.positions.length; i++) {
            output += `${polyarea.positions[i].x}`;
            if (i !== polyarea.positions.length - 1) {
                output += ",";
            }
        }
        output += "]\ny = [";
        for (var i = 0; i < polyarea.positions.length; i++) {
            output += `${polyarea.positions[i].y}`;
            if (i !== polyarea.positions.length - 1) {
                output += ",";
            }
        }
        output += ']\n'
        if (polyarea.positions.length > 0 && polyarea.positions[0].z > 0) {
            output += `level = ${polyarea.positions[0].z}\n`;
        }
        return output;
    }
}