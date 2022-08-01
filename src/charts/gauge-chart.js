import {MarginMixin} from '../base/margin-mixin';
import {ColorMixin} from '../base/color-mixin';
import {range} from 'd3-array';
import {lineRadial,arc,line} from 'd3-shape';
import {scaleLinear} from 'd3-scale';
import {easeQuad} from 'd3-ease';
import {format} from 'd3-format';

const pi = Math.PI, rad = pi/180, deg = 180/pi;

export class GaugeChart extends ColorMixin(MarginMixin) {
    constructor (parent, chartGroup) {
        super();

        this._formatNumber = '.2s',
        this._dial = {
            thickness: 0.15,
            size: 1,
            rotation: 0
        },
        this._ticks = {
            count: 2,
            color: '#FFFFFF',
            label: false,
            fontSize: '0.5em',
        },
        this._needle = {
            color:'#E85116',
            width: 3
        },
        this._limit = {
            values:[],
            label: false,
            color:'#FFFFFF',
            fontSize: '8px'
        },
        this._indicator = {
            show: false,
            fontSize: ''
        }

        this._colorStep = 150,
        this._max = 0,
        this._g = undefined,
        this._radii = {},
        this._angles = {},
        this._gradient = {},
        this._scales = {}

        this._mandatoryAttributes(['group']);
        this._formatter = format(this._formatNumber); 
        this.ordering(kv => kv.value);
        this.data(group => {
            // eslint-disable-next-line max-len
            const valObj = group.value ? (typeof(group.value())==='object' ? group.value() : {key:1, value:group.value()}) : this._maxBin(group.all());
            return this.valueAccessor()(valObj);
        });
        this.transitionDuration(350);
        this.transitionDelay(10);        
        this.anchor(parent, chartGroup);
    }
    formatNumber (value) {
        if (!arguments.length) {
            return this._formatNumber;
        }
        this._formatNumber = value;
        return this;
    }
    colorStep (value) {
        if (!arguments.length) {
            return this._colorStep;
        }
        this._colorStep = value;
        return this;
    }
    max (value) {
        if (!arguments.length) {
            return this._max;
        }
        this._max = value;
        return this;
    }    
    dial (params) {
        if (!arguments.length) {
            return this._dial;
        }
        this._setProperties (params, this._dial)        
        return this;
    }    
    ticks (params) {
        if (!arguments.length) {
            return this._ticks;
        }
        this._setProperties (params, this._ticks)        
        return this;
    }
    needle (params) {
        if (!arguments.length) {
            return this._needle;
        }
        this._setProperties (params, this._needle)        
        return this;        
    }
    limit (params) {
        if (!arguments.length) {
            return this._limit;
        }
        this._setProperties (params, this._limit)
        return this;        
    }
    indicator (params) {
        if (!arguments.length) {
            return this._indicator;
        }
        this._setProperties (params, this._indicator)
        return this;        
    }    
    margins (margins) {
        if (!arguments.length) {
            return this._margin;
        }
        if(typeof(margins)==='number'){
            for(const n in this._margin){
                this._margin[n] = margins;        
            }
        } else {
            this._margin = margins;
        }
        return this;
    }

    _value () {
        return this.data();
    }

    _maxBin (all) {
        if (!all.length) {
            return null;
        }
        const sorted = this._computeOrderedGroups(all);
        return sorted[sorted.length - 1];
    }

    _setRadii () {
        let base = this.height() - this._margin.top - this._margin.bottom;
        
        if (this._dial.size > 1) {
            base = base / (1 + Math.sin(pi * (this._dial.size - 1)/2));
        }
        
        this._radii.base = base, 
        this._radii.cap = base / 15,
        this._radii.inner = base * (1 - this._dial.thickness),
        this._radii.outerTick = base + 5,
        this._radii.tickLabel = base + 15,
        this._radii.needleLength = this._radii.inner * (1 + this._dial.thickness);
        
        return this;
    }

    _setCenter () {
        const center = {};       
        center.x = this.width() / 2,
        center.y = this._radii.base + this._margin.bottom;
        
        return center;
    }

    _setAngles () {
        const arcComplement = 1 - this._dial.size;
        
        this._angles.arcComplement = arcComplement,
        this._angles.startAngle = (-pi/2) + (pi * arcComplement / 2) + (this._dial.rotation * rad),
        this._angles.endAngle = (pi/2) - (pi * arcComplement / 2) + (this._dial.rotation * rad);
        
        return this;   
    }
  
    _setTicks () {
    
        const subArc = (this._angles.endAngle - this._angles.startAngle) / (this._ticks.count - 1), tickPct = 100 / (this._ticks.count - 1);
        this._ticksData = range(this._ticks.count).map(d => {
            // eslint-disable-next-line max-len
            const subAngle = this._angles.startAngle + (subArc * d), tickNumber = this._max ? this._formatter((tickPct * d * this._max / 100).toFixed(0)): `${(tickPct * d).toFixed(0)}%`;
            return {
                label: tickNumber,
                angle: subAngle,
                coordinates: [[subAngle, this._radii.inner], [subAngle, this._radii.outerTick]]
            }
        });
        return this;
    }

    _setLimit () {
        if(this._limit.values.length && this._max){
            const _max = this._max, span = (this._angles.endAngle - this._angles.startAngle);
            this._limitData = this._limit.values.map(d => {
                const subAngle = this._angles.startAngle + (d/_max * span);
                return {
                    label: this._formatter(d),
                    angle: subAngle,
                    coordinates: [[subAngle, this._radii.inner], [subAngle, this._radii.base]]
                }
            });
        }

        return this;
    }    
    
    _setGradient () {
        
        const c = this.colors(),
            samples = this._colorStep,
            totalArc = this._angles.endAngle - this._angles.startAngle, 
            subArc = totalArc / (samples);
        if(typeof(c)!=='function'){
            this._gradient = [{
                fill: c,
                start: this._angles.startAngle,
                end: this._angles.endAngle    
            }]
            return this;
        }
        this._gradient = range(samples).map( d => {
            const subColor = d / (samples - 1),
                subStartAngle = this._angles.startAngle + (subArc * d),
                subEndAngle = subStartAngle + subArc;
            return {
                fill: c(subColor),
                start: subStartAngle,
                end: subEndAngle
            }
        });
        
        return this;
        
    }
  
    _setScales () {
            
        this._scales.lineRadial = lineRadial();

        this._scales.subArcScale = arc()
            .innerRadius(this._radii.inner + 1)
            .outerRadius(this._radii.base)
            .startAngle(d => d.start)
            .endAngle(d => d.end);

        this._scales.needleScale = scaleLinear()
            .domain([0, 1])
            .range([this._angles.startAngle, this._angles.endAngle]);

        return this;
        
    }

    _updateParameters () {
        this._setRadii();
        this._setAngles();
        this._setGradient();
        this._setScales();
    }   

    _setProperties (params, target) {
        Object.keys(params).map(d => {
            if (typeof(target[d]) !== 'undefined'){
                target[d] = params[d];
            }else{
                console.log(`Parameters ${d} is not accepted.`);
            }
        });  
    }

    _update (newValue) {
        this._max = !this._max ? newValue : this._max;
        const _needlePercent = this._max < newValue ? 1 : newValue/this._max, span = (this._angles.endAngle - this._angles.startAngle);
        
        const newAngle = (this._angles.startAngle + (span * _needlePercent)) * deg;

        this._pointer.transition()
            .duration(this.transitionDuration())
            .ease(easeQuad)
            .attr('transform', `rotate(${newAngle})`);

        // eslint-disable-next-line max-len
        const fontColor = this._limit.values.length && (newValue < this._limit.values[0] || newValue > this._limit.values[this._limit.values.length - 1]) ? 'red' :'gray';

        this._indicatorDisplay
            .data([newValue])
            .style('fill', fontColor)
            .transition()
            .duration(this.transitionDuration())
            .delay(this.transitionDelay())
            .ease(easeQuad)
            .text(d=>this._formatter(d));

        return this;
    }    

    _doRender () {
        this._updateParameters();        
        this.resetSvg();
        this._drawChart(this._value());
        return this;
    }

    _doRedraw () {
        this._update(this._value()); 
        return this;
    }

    // eslint-disable-next-line complexity
    _drawChart (newValue) {
        this._g = this.svg();
        const _center = this._setCenter(), tickLabel = this._radii.tickLabel;
        const gauge = this._g.append('g')
            .attr('transform', `translate(${_center.x}, ${_center.y})`)
            .attr('class', 'gauge-container');

        gauge.append('g')
            .attr('class', 'gauge-arc')
            .selectAll('path')
            .data(this._gradient)
            .enter()
            .append('path')
            .attr('d', this._scales.subArcScale)
            .attr('stroke-width', 0.7)
            .attr('fill', d => d.fill)
            .attr('stroke', d => d.fill);
            
        if(this._ticks.count > 2){
            this._setTicks();

            gauge.append('g')
            .attr('class', 'gauge-ticks')
            .selectAll('path')
            .data(this._ticksData)
            .enter()
            .append('g')
            .attr('class', 'tick')
            .append('path')
            .attr('d', d => this._scales.lineRadial(d.coordinates))
            .attr('stroke', this._ticks.color)
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round')
            .attr('fill', 'none');

            if (this._ticks.label) {
                gauge.select('g.gauge-ticks')
                    .selectAll('text')
                    .data(this._ticksData)
                    .enter()
                    .append('g')
                    .attr('class', 'tick-label')
                    .append('text')
                    // eslint-disable-next-line max-len
                    .attr('transform', d => `translate(${tickLabel * Math.sin(d.angle)}, ${-tickLabel * Math.cos(d.angle)}) rotate(${d.angle * deg - pi})`)
                    .attr('dy', '1em')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', this._ticks.fontSize)
                    .text(d => d.label);
            }            
        }

        if(this._limit.values.length && this._max){
            this._setLimit();

            gauge.append('g')
            .attr('class', 'gauge-limit')
            .selectAll('path')
            .data(this._limitData)
            .enter()
            .append('g')
            .attr('class', 'tick')
            .append('path')
            .attr('d', d => this._scales.lineRadial(d.coordinates))
            .attr('stroke', this._limit.color)
            .attr('stroke-width', 3)
            .attr('stroke-linecap', 'round')
            .attr('fill', 'none');

            if(this._limit.label){
                gauge.select('g.gauge-limit')
                    .selectAll('text')
                    .data(this._limitData)
                    .enter()
                    .append('g')
                    .attr('class', 'limit-label')
                    .append('text')
                    // eslint-disable-next-line max-len
                    .attr('transform', d => `translate(${tickLabel * Math.sin(d.angle)}, ${-tickLabel * Math.cos(d.angle)}) rotate(${d.angle * deg})`)
                    .attr('dy', '1em')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', this._limit.fontSize)
                    .text(d => d.label);
            }    
        }

        const _newValue = newValue === undefined ? 0 : newValue;

        if(this._indicator.show){
            const fontSize = this._indicator.fontSize ? this._indicator.fontSize : `${this._radii.base/4}px`;

            this._indicatorDisplay = this._g
                .append('text')
                .attr('class', 'indicator')
                .attr('text-anchor', 'middle')
                .attr('font-size', fontSize)
                .attr('font-weight', 'bold')
                .attr('transform',`translate(${_center.x}, ${_center.y*0.8})`);    
        }

        const pointerTailLength = 5;

        const lineData = [
            [this._needle.width, 0], 
            [0, -this._radii.needleLength],
            [-(this._needle.width), 0],
            [0, pointerTailLength],
            [this._needle.width, 0]
        ];
        const pointerLine = line();
        const pg = this._g.append('g').data([lineData])
				.attr('class','pointer')
				.attr('transform',`translate(${_center.x}, ${_center.y})`)
                .attr('stroke',this._needle.color)
                .attr('fill',this._needle.color);
				
        this._pointer = pg.append('path')
			.attr('d', pointerLine)
			.attr('transform', `rotate(${this._angles.startAngle*deg})`);

        this._update(_newValue);
        
        return this;
        
    }

}
export const gaugeChart = (parent, chartGroup) => new GaugeChart(parent, chartGroup);
