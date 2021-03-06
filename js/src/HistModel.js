/* Copyright 2015 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var _ = require("underscore");
var d3 = require("d3");
var markmodel = require("./MarkModel");

var HistModel = markmodel.MarkModel.extend({

    defaults: function() {
        return _.extend(markmodel.MarkModel.prototype.defaults(), {
            _model_name: "HistModel",
            _view_name: "Hist",
            sample: [],
            count: [],
            scales_metadata: {
                sample: { orientation: "horizontal", dimension: "x" },
                count: { orientation: "vertical", dimension: "y" }
            },
            bins: 10,
            midpoints: [],
            colors: d3.scale.category10().range(),
            stroke: null,
            opacities: [],
            normalized: false
        });
    },

    initialize: function() {
        // TODO: should not need to set this.data
        HistModel.__super__.initialize.apply(this, arguments);
        this.mark_data = [];
        // For the histogram, changing the "sample" scale changes the "count" values being plotted.
        // Hence, on change of the value of "preserve_domain", we must call the "update_data"
        // function, and not merely "update_domains".
        this.on_some_change(["bins", "sample", "preserve_domain"], this.update_data, this);
        this.update_data();
        this.on("change:normalized", function() { this.normalize_data(true); }, this);
        this.normalize_data(true);
    },

    update_data: function() {
        var x_data = this.get_typed_field("sample");
        var scales = this.get("scales");
        var x_scale = scales.sample;

        // TODO: This potentially triggers domain_changed and therefore a
        // Draw, while update_data is generally followed by a Draw.
        this.num_bins = this.get("bins");
        if (x_data.length == 0) {
            this.mark_data = [];
            this.x_mid = [];
            this.count = [];
            this.x_bins = [];
        } else {
            if(!this.get("preserve_domain").sample) {
                x_scale.compute_and_set_domain(x_data, this.model_id + "_sample");
            } else {
                x_scale.del_domain([], this.model_id + "_sample");
            }

            this.min_x = x_scale.domain[0];
            this.max_x = x_scale.domain[1];

            var that = this;
            x_data = x_data.filter(function(d) {
                return (d <= that.max_x && d >= that.min_x);
            });
            var x_data_ind = x_data.map(function (d,i) {
                return {index: i, value: d};
            });

            this.x_bins =  this.create_uniform_bins(this.min_x, this.max_x, this.num_bins);
            this.x_mid = this.x_bins.map(function(d, i) {
                return 0.5 * (d + that.x_bins[i - 1]);
            }).slice(1);

            this.mark_data = d3.layout.histogram().bins(this.x_bins).value(function(d) {
                return d.value;
            })(x_data_ind);
            //adding index attribute to mark_data of the model
            this.mark_data.forEach(function(data, index) { data.index = index; });
        }
        this.normalize_data(false);

        this.set("midpoints", this.x_mid);
        this.set_typed_field("count", this.count);

        this.update_domains();
        this.save_changes();
        this.trigger("data_updated");
    },

    normalize_data: function(save_and_update) {


        this.count = this.mark_data.map(function(d) { return d.length; });
        if (this.get("normalized")) {
            var x_width = 1;
            if(this.mark_data.length > 0) {
                x_width = this.mark_data[0].dx;
            }

            var sum = this.count.reduce(function(a, b) { return a + b; }, 0);
            if (sum != 0) {
                this.count = this.count.map(function(a) { return a / (sum * x_width); });
            }
        }

        var that = this;
        this.mark_data.forEach(function(el, it) { el['y'] = that.count[it]; });

        if (save_and_update) {
            this.set_typed_field("count", this.count);
            this.update_domains();
            this.save_changes();
            this.trigger("data_updated");
        }
    },

    get_data_dict: function(data, index) {
        var return_dict = {};
        return_dict.midpoint = this.x_mid[index];
        return_dict.bin_start = this.x_bins[index];
        return_dict.bin_end = this.x_bins[index + 1];
        return_dict.index = index;
        return_dict.count = this.count[index];
        return return_dict;
    },

    update_domains: function() {
        if(!this.mark_data) {
            return;
        }
        // For histogram, changing the x-scale domain changes a lot of
        // things including the data which is to be plotted. So the x-domain
        // change is handled by the update_data function and only the
        // y-domain change is handled by this function.
        var y_scale = this.get("scales").count;
        if(!this.get("preserve_domain").count) {
            y_scale.set_domain([0, d3.max(this.mark_data, function(d) {
                return d.y;
            }) * 1.05], this.model_id + "_count");
        }
    },

    create_uniform_bins: function(min_val, max_val, num_bins) {
        var diff = max_val - min_val;
        var step_size = (diff) / num_bins;
        var return_val = [];
        for(var i=0; i<num_bins; i++) {
            return_val[i] = min_val+ i * step_size;
        }
        return_val[num_bins] = max_val;
        return return_val;
    }
});

module.exports = {
    HistModel: HistModel
};
