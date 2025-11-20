# About

In this project, I updated the original visualization to better represent the data and reduce misleading patterns. Instead of plotting raw gun death counts, which unfairly exaggerate larger states or cities with bigger populations, I normalized the values by calculating deaths per 100,000 people. This scaling allows for a more accurate comparison across regions. In addition, I improved the data encoding by using circle areas proportional to normalized rates (rather than raw counts), a stacked bar chart for gender-based analysis, clarifying titles, tooltips showing both raw and normalized values, and legends that explain the scales and color encodings. These updates make the visualization more truthful and transparent.  

This work is "white-hat" because it emphasizes integrity and fairness in how the data is presented. By acknowledging population differences, clarifying scales, adding context through titles and legends, and crediting data sources, the visualization avoids common pitfalls of misleading graphs. It transforms what could be a sensational or skewed depiction into an honest, interpretable, and responsible communication of gun violence data.  

---

# Data & Code Sources

- **State map GeoJSON**: [Eric Celeste’s US GeoJSON](https://eric.clst.org/tech/usgeojson/)  
- **Original state population data**: [US Census Bureau](https://www.census.gov/data/tables/time-series/demo/popest/2010s-state-total.html)  
- **Gun violence dataset**: [Slate – Every American Gun Death Since Newtown](https://www.slate.com/articles/news_and_politics/crime/2012/12/gun_death_tally_every_american_gun_death_since_newtown_sandy_hook_shooting.html)  
- **Inspiration for D3 patterns**: [D3.js Documentation](https://d3js.org/) and community examples.  
- **Colorbrewer**: [Colorbrewer of PuBu](https://colorbrewer2.org/#type=sequential&scheme=PuBu&n=3)

## Demo Video

Watch the demo here: [WhiteHat Visualization Demo](https://drive.google.com/file/d/1X0q-KCCG3ktB_GrCWPVu2hkMqkCNinZt/view?usp=sharing)


<iframe src="https://drive.google.com/file/d/1X0q-KCCG3ktB_GrCWPVu2hkMqkCNinZt/preview" 
        width="640" height="480" allow="autoplay">
</iframe>
