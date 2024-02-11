import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View} from 'react-native';
import {geoDistanceFt, getUgaData, getAccData, getArrivals} from './fetch';

const App = () => {
  const [isLoading, setLoading] = useState(true);
  const [arrivalStops, setArrivalStops] = useState([]);

  const timeBase = Date.now();

  const formatTime = (date) => {
    let hour = date.getHours();
    let ampm = 'AM';
    if (hour >= 12) {
      hour -= 12;
      ampm = 'PM';
    }
    if (hour == 0)
      hour = 12;
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${min} ${ampm}`;
  };

  const formatTimeSpan = (date) => {
    let value = date.valueOf() - timeBase;
    value = Math.floor(value / 60000);
    if (value === 0)
      return '0 min';
    const parts = [];
    if (value % 60 !== 0)
      parts.unshift(`${value % 60} min`);
    value = Math.floor(value / 60);
    if (value % 24 !== 0)
      parts.unshift(`${value % 24} hr`);
    value = Math.floor(value / 24);
    if (value !== 0)
      parts.unshift(`${value} d`);
    return parts.join(' ');
  };

  const getArrivalStops = async () => {
    try {
      const uga = await getUgaData();
      const acc = await getAccData();
      const routes = [...uga.routes.values(), ...acc.routes.values()];
      const stops = [...uga.stops.values(), ...acc.stops.values()];
      const userPos = [33.951675, -83.376325];
      const maxDistanceFt = 0.5 * 5280;
      const mphToFtps = 22 / 15;
      const walkingSpeedFtps = 3 * mphToFtps;
      for (const stop of stops)
        stop.distanceFt = geoDistanceFt(userPos, stop.pos);
      const sortedStops = stops.filter(stop => stop.distanceFt <= maxDistanceFt);
      sortedStops.sort((stop1, stop2) => stop1.distanceFt - stop2.distanceFt);
      const arrivals = [];
      for (const stop of sortedStops) {
        const minOffsetSec = stop.distanceFt / walkingSpeedFtps;
        arrivals.push(...await getArrivals(uga, acc, stop, minOffsetSec));
      }
      arrivals.sort((arrival1, arrival2) => arrival1.date - arrival2.date);
      const arrivalStops = new Map();
      for (const arrival of arrivals) {
        if (!arrivalStops.has(arrival.stop.id))
          arrivalStops.set(arrival.stop.id, []);
        arrivalStops.get(arrival.stop.id).push(arrival);
      }
      setArrivalStops([...arrivalStops.values()]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getArrivalStops();
  }, []);

  const FancyLabel = ({route}) => {
    return (
      <View style={{
        backgroundColor: route.bgColor,
        width: 35,
        borderRadius: 10,
        padding: 1,
        margin: 1,
      }}>
        <Text style={{
          color: route.fgColor,
          fontWeight: 'bold',
          textAlign: 'center',
        }}>{route.label}</Text>
      </View>
    );
  };

  const StopCard = ({arrivals}) => {
    const stop = arrivals[0].stop;
    return (
      <View style={{
        borderColor: 'black',
        borderWidth: 1,
        borderRadius: 10,
        padding: 5,
      }}>
        <Text style={{fontWeight: 'bold'}}>{stop.name}</Text>
        <Text>{Math.round(stop.distanceFt)} ft away</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <FancyLabel route={arrivals[0].route}/>
          <Text> {formatTimeSpan(arrivals[0].date)} ({formatTime(arrivals[0].date)})</Text>
        </View>
        <FlatList
          horizontal={true}
          data={arrivals.slice(1)}
          keyExtractor={(arrival) => arrival.date.valueOf()}
          renderItem={({item}) => <FancyLabel route={item.route}/>}
        />
      </View>
    );
  };

  return (
    <View style={{flex: 1, padding: 24}}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View style={{height: 5}}></View>}
          data={arrivalStops}
          keyExtractor={(arrivals) => arrivals[0].stop.id}
          renderItem={({item}) => <StopCard arrivals={item}/>}
        />
      )}
    </View>
  );
};

export default App;
