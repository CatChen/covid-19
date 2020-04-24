import React from 'react';
import { ResponsiveContainer, LineChart, Label, Line, ReferenceLine, ReferenceArea, YAxis, XAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { makeStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import { scaleSymlog } from 'd3-scale';
import { datesToDays, fitExponentialTrendingLine } from './TrendFitting';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import { myShortNumber } from '../Util';
import { Summary } from './Summary';
import { AntSwitch } from "./AntSwitch"

const Cookies = require("js-cookie");
const moment = require("moment");
const scale = scaleSymlog().domain([0, 'dataMax']);

const useStyles = makeStyles(theme => ({
  customtooltip: {
    backgroundColor: "#FFFFFF",
  },
  grow: {
    flex: 1,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 130,
    maxWidth: 300,
  },
}));

const CustomTooltip = (props) => {
  const classes = useStyles();
  const { active } = props;
  if (active) {
    const today = moment().format("M/D");
    const { payload, label } = props;
    let confirmed;
    let newcase;
    let death;

    payload.map(p => {
      p = p.payload;
      if ("confirmed" in p) {
        confirmed = p.confirmed;
      }
      if ("pending_confirmed" in p) {
        confirmed = p.pending_confirmed;
      }
      if ("newcase" in p) {
        newcase = p.newcase;
      }
      if ("pending_newcase" in p) {
        newcase = p.pending_newcase;
      }
      if ("pending_death" in p) {
        death = p.pending_death;
      }
      if ("death" in p) {
        death = p.death;
      }
      return null;
    });

    if (typeof payload[0] == 'undefined') {
      // This can happen when all the three lines are hidden
      return null;
    }
    let pending_help;
    if (today === payload[0].payload.name) {
      pending_help = "Last # potentially incomplete";
    }

    return (
      <div className={classes.customtooltip}>
        <Typography variant="body1" noWrap>
          {label}
        </Typography>
        <Typography variant="body2" noWrap>
          {`Confirmed: ${confirmed}`}
        </Typography>
        <Typography variant="body2" noWrap>
          {`New: ${newcase}`}
        </Typography>
        <Typography variant="body2" noWrap>
          {pending_help}
        </Typography>
        <Typography variant="body2" noWrap>
          Total Death: {death}
        </Typography>
      </div>
    );
  }
  return null;
}

const trendingLineLabelChildren = (options) => {
  const { x, y, showlog, dailyGrowthRate, daysToDouble } = options;
  return [
    // Placeholder to accomodate label
    <ReferenceArea fillOpacity="0" x1={x} x2={x} y1={y * (showlog ? 4 : 1.1)} y2={y * (showlog ? 4 : 1.1)} key={0} />,
    <ReferenceArea fillOpacity="0" x1={x} x2={x} y1={y} y2={y} key={1}>
      <Label value={`${daysToDouble.toFixed(0)} days to double (+${(dailyGrowthRate * 100).toFixed(0)}% daily)`} offset={5} position="insideBottomRight" />
    </ReferenceArea>
  ];
}

const BasicGraphNewCases = (props) => {
  const CookieSetPreference = (state) => {
    Cookies.set("BasicGraphPreference", state, {
      expires: 100
    });
  }
  const CookieGetPreference = () => {
    let pref = Cookies.getJSON("BasicGraphPreference");
    if (!pref) {
      return {
        showlog: false,
        show2weeks: false,
        showConfirmed: true,
        showNewCase: true,
        showDeath: true,
      }
    }
    return pref;
  }
  const classes = useStyles();
  const [state, setState] = React.useState(CookieGetPreference());

  const [USData, setUSdata] = React.useState(null);
  React.useEffect(() => {
    props.source.dataPointsAsync().then(data => setUSdata(data));
  }, [props.source])

  if (!USData || USData.length === 0) {
    return <div> Loading</div>;
  }

  let data = USData;
  const setStateSticky = (state) => {
    CookieSetPreference(state);
    setState(state);
  }

  const handleLogScaleToggle = event => {
    setStateSticky({ ...state, showlog: !state.showlog });
  };

  const handle2WeeksToggle = event => {
    let newstate = { ...state, show2weeks: !state.show2weeks };
    setStateSticky(newstate);
  };

  let graphOptions = [
    { name: 'Total', value: state.showConfirmed },
    { name: 'New', value: state.showNewCase },
    { name: 'Death', value: state.showDeath },
  ];

  const handleGraphOptionsChange = event => {
    let selected = event.target.value;
    setStateSticky({
      ...state,
      showConfirmed: selected.includes('Total'),
      showNewCase: selected.includes('New'),
      showDeath: selected.includes('Death'),
    });
  };

  data = data.map(d => {
    d.name = moment(d.fulldate, "MM/DD/YYYY").format("M/D");
    return d;
  });

  let newdata = [];
  for (let i = 0; i < data.length; i++) {
    let item = data[i];
    if (i === 0) {
      item.newcase = data[i].confirmed;
    } else {
      item.newcase = data[i].confirmed - data[i - 1].confirmed;
    }
    newdata.push(item)
  }
  data = newdata;

  if (data.length > 2) {
    let newdata = data.slice(0, data.length - 2);
    let second_last = data[data.length - 2];
    let last = data[data.length - 1];
    second_last.pending_confirmed = second_last.confirmed;
    second_last.pending_newcase = second_last.newcase;
    second_last.pending_death = second_last.death;
    let newlast = {
      name: last.name,
      fulldate: moment().format("MM/DD/YYYY"),
      pending_confirmed: last.confirmed,
      pending_newcase: last.newcase,
      pending_death: last.death,
    };
    newdata.push(second_last);
    newdata.push(newlast);
    data = newdata;
  }

  /**
   * Add Trending Line
   */
  const startDate = data[0].name;
  const dates = data.map(d => d.name);
  const daysFromStart = datesToDays(startDate, dates);
  const confirmed = data.map(d => d.confirmed);
  const results = fitExponentialTrendingLine(daysFromStart, confirmed, 10);
  let dailyGrowthRate = null;
  let daysToDouble = null;
  let lastTrendingData = null;
  if (results != null) {
    data = data.map((d, idx) => {
      d.trending_line = results.fittedYs[idx];
      return d;
    });
    dailyGrowthRate = results.dailyGrowthRate;
    daysToDouble = results.daysToDouble;
    lastTrendingData = data[data.length - 1];
  }

  if (state.show2weeks) {
    const cutoff = moment().subtract(14, 'days')
    data = data.filter(d => {
      return moment(d.fulldate, "MM/DD/YYYY").isAfter(cutoff)
    });
  } else {

    const cutoff = moment().subtract(30, 'days')
    data = data.filter(d => {
      return moment(d.fulldate, "MM/DD/YYYY").isAfter(cutoff)
    });
  }


  data = data.sort((a, b) => moment(a.fulldate, "MM/DD/YYYY").toDate() - (moment(b.fulldate, "MM/DD/YYYY")).toDate());

  /**
   * Vertical reference lines.
   * Example usage:
   *     let vRefLines = [
   *         {date: '3/20', label: 'shelter in place'},
   *         {date: '3/25', label: 'some other event'},
   *     ];
   *     <BasicGraphNewCases vRefLines={vRefLines} .../>
   */
  let vRefLines = (typeof props.vRefLines == 'undefined') ?
    null :
    props.vRefLines.map((l, idx) =>
      <ReferenceLine key={`vrefline${idx}`} x={l.date} label={{ value: l.label, fill: '#b3b3b3' }} stroke="#e3e3e3" strokeWidth={3} />
    )

  /**
   * Horizontal reference lines.
   * Example usage:
   *     let hRefLines = [
   *         {y: '100', label: '# ventilators'},
   *         {y: '1000', label: '# beds'},
   *     ];
   *     <BasicGraphNewCases hRefLines={hRefLines} .../>
   */
  let hRefLines = (typeof props.hRefLines == 'undefined') ?
    null :
    props.hRefLines.map((l, idx) =>
      <ReferenceLine key={`hrefline${idx}`} y={l.y} label={l.label} stroke="#e3e3e3" strokeWidth={2} />
    )

  return <>
    <Summary source={props.source} />
    <Grid container alignItems="center" spacing={1}>
      <Grid item>
        <AntSwitch checked={state.showlog} onClick={handleLogScaleToggle} />
      </Grid>
      <Grid item onClick={handleLogScaleToggle}>
        <Typography>
          Log
                </Typography>
      </Grid>
      <Grid item></Grid>

      <Grid item>
        <AntSwitch checked={state.show2weeks} onClick={handle2WeeksToggle} />
      </Grid>
      <Grid item onClick={handle2WeeksToggle}>
        <Typography>
          2 weeks
                </Typography>
      </Grid>
      <Grid item xs></Grid>

      <Grid item>
        <FormControl size="medium" className={classes.formControl}>
          <Select
            id="new-case-graph-options-checkbox"
            multiple
            value={graphOptions.filter(o => o.value).map(o => o.name)}
            onChange={handleGraphOptionsChange}
            input={<Input />}
            renderValue={selected => 'Lines'}
          >
            {graphOptions.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                <Checkbox checked={option.value} />
                <ListItemText primary={option.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
    <ResponsiveContainer height={300} >
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
      >
        <Tooltip content={<CustomTooltip />} />
        <XAxis dataKey="name" />
        {
          state.showlog ?
            <YAxis yAxisId={0} scale={scale} /> :
            <YAxis yAxisId={0} tickFormatter={(t) => myShortNumber(t)} tick={{ fill: '#ff7300' }} />
        }
        <YAxis yAxisId={1} tickFormatter={(t) => myShortNumber(t)} tick={{ fill: '#377908' }} orientation="right" />

        <CartesianGrid stroke="#d5d5d5" strokeDasharray="5 5" />
        {state.showConfirmed && <Line type="monotone" dataKey="trending_line" strokeDasharray="2 2" stroke="#DDD" yAxisId={0} dot={false} isAnimationActive={false} strokeWidth={2} />}
        {state.showConfirmed && <Line type="monotone" dataKey="confirmed" stroke="#ff7300" yAxisId={0} dot={{ r: 1 }} strokeWidth={2} />}
        {state.showConfirmed && <Line type="monotone" dataKey="pending_confirmed" stroke="#ff7300" dot={{ r: 1 }} strokeDasharray="2 2" strokeWidth={2} />}

        {state.showNewCase && <Line type="monotone" dataKey="newcase" stroke="#387908" yAxisId={1} dot={{ r: 1 }} strokeWidth={2} />}
        {state.showNewCase && <Line type="monotone" dataKey="pending_newcase" stroke="#387908" yAxisId={1} dot={{ r: 1 }} strokeDasharray="2 2" strokeWidth={2} />}

        {state.showDeath && <Line type="monotone" dataKey="death" stroke="#000000" yAxisId={1} dot={{ r: 1 }} strokeWidth={2} />}
        {state.showDeath && <Line type="monotone" dataKey="pending_death" stroke="#000000" yAxisId={1} dot={{ r: 1 }} strokeDasharray="2 2" strokeWidth={2} />}
        <Line visibility="hidden" dataKey="pending_death" />

        {vRefLines}
        {hRefLines}

        {state.showConfirmed && lastTrendingData != null && trendingLineLabelChildren({
          x: lastTrendingData.name,
          y: lastTrendingData.trending_line,
          dailyGrowthRate,
          daysToDouble,
          showlog: state.showlog
        }
        )}

        <Legend verticalAlign="top" payload={[
          { value: 'Total ', type: 'line', color: '#ff7300' },
          { value: 'New Cases', type: 'line', color: '#389708' },
          { value: 'Death', type: 'line', color: '#000000' },
        ]} />

      </LineChart></ResponsiveContainer>
  </>
}

export { BasicGraphNewCases };
