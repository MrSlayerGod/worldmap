'use strict';

export var TitleLabel = L.Control.extend({
    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div');
        container.id = 'titleLabel';
        container.href = 'https://github.com/GregHib/void/';
        container.innerHTML = "<span id='void'>Void</span>'s Map";

        L.DomEvent.disableClickPropagation(container);
        return container;
    }
});