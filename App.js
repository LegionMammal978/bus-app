import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View} from 'react-native';
import {geoDistanceFt, getUgaData, getAccData, getArrivals} from './fetch';

const App = () => {
  const [isLoading, setLoading] = useState(true);
  const [arrivalStops, setArrivalStops] = useState(new Map());

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
      setArrivalStops(arrivalStops);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getArrivalStops();
  }, []);

  return (
    <View style={{flex: 1, padding: 24}}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          ItemSeparatorComponent={
            <View
              style={{
                borderBottomColor: 'black',
                borderBottomWidth: StyleSheet.hairlineWidth,
              }}
            />
          }
          data={[...arrivalStops.entries()]}
          keyExtractor={([stopId, _]) => stopId}
          renderItem={({item}) => {
            const [_, arrivals] = item;
            return (
              <>
                <Text>Stop: {arrivals[0].stop.name}</Text>
                <FlatList
                  data={arrivals}
                  keyExtractor={(arrival) => arrival.date.valueOf()}
                  renderItem={({item}) => (
                    <>
                      <Text>Arrival time: {formatTime(item.date)}</Text>
                      <Text>
                        Arrival route:{' '}
                        <Text style={{
                          color: item.route.fgColor,
                          backgroundColor: item.route.bgColor,
                        }}>{item.route.label}</Text>
                        {' '}({item.route.name})
                      </Text>
                      <Text>Arrival bus: {item.vehicle.name}</Text>
                    </>
                  )}
                />
              </>
            );
          }}
        />
      )}
    </View>
  );
};

export default App;
