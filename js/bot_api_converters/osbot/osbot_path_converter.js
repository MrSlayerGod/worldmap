'use strict';

import {Position} from '../../model/Position.js';
import {Path} from '../../model/Path.js';
import {OSBotConverter} from './osbot_converter.js';

export class OSBotPathConverter extends OSBotConverter {


    /*
    API Doc:
        https://osbot.org/api/org/osbot/rs07/api/map/Position.html
        
        Position(int x, int y, int z)
    */
    fromJava(text, path) {
        path.removeAll();
        text = text.replace(/\s/g, '');
        var posPattern = `new${this.javaPosition}\\((\\d+,\\d+,\\d)\\)`;
        var re = new RegExp(posPattern, "mg");
        var match;
        while ((match = re.exec(text))) {
            var values = match[1].split(",");
            path.add(new Position(values[0], values[1], values[2]));
        }
    }

    toRaw(path) {
        var output = "";
        for (var i = 0; i < path.positions.length; i++) {
            output += `${path.positions[i].x},${path.positions[i].y},${path.positions[i].z}\n`;
        }
        return output;
    }

    toJavaSingle(position) {
        return `${this.javaPosition} position = new ${this.javaPosition}(${position.x}, ${position.y}, ${position.z});`;
    }

    toJavaArray(path) {
        if (path.positions.length == 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            var output = `${this.javaPosition}[] path = {\n`;
            for (var i = 0; i < path.positions.length; i++) {
                output += `    new ${this.javaPosition}(${path.positions[i].x}, ${path.positions[i].y}, ${path.positions[i].z})`;
                if (i != path.positions.length - 1) output += ",";
                output += "\n";
            }
            output += "};";
            return output;
        }
        return "";
    }

    toGroml(path) {
        var output = `x = [`;
        for (var i = 0; i < path.positions.length; i++) {
            if (i !== 0) output += ','
            output += `${path.positions[i].x}`;
        }
        output += ']\ny = ['
        for (var i = 0; i < path.positions.length; i++) {
            if (i !== 0) output += ','
            output += `${path.positions[i].y}`;
        }
        output += ']\n'
        if (path.plane > 0) {
            output += `level = ${path.plane}\n`;
        }
        return output;
    }

    fromGroml(text, path) {
        path.removeAll();
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
            path.add(new Position(x[i], y[i], level));
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

    toJavaList(path) {
        if (path.positions.length == 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            var output = `List&lt;${this.javaPosition}&gt; path = new ArrayList<>();\n`;
            for (var i = 0; i < path.positions.length; i++) {
                output += `path.add(new ${this.javaPosition}(${path.positions[i].x}, ${path.positions[i].y}, ${path.positions[i].z}));\n`;
            }
            return output;
        }
        return "";
    }

    toJavaArraysAsList(path) {
        if (path.positions.length == 1) {
            return this.toJavaSingle(path.positions[0]);
        } else if (path.positions.length > 1) {
            var output = `List&lt;${this.javaPosition}&gt; path = Arrays.asList(\n    new ${this.javaPosition}[]{\n`;
            for (var i = 0; i < path.positions.length; i++) {
                output += `        new ${this.javaPosition}(${path.positions[i].x}, ${path.positions[i].y}, ${path.positions[i].z})`;
                if (i != path.positions.length - 1) output += ",";
                output += "\n";
            }
            output += "    }\n);";
            return output;
        }
        return "";
    }
}