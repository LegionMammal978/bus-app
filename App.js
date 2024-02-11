import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Pressable, RefreshControl, Text, View} from 'react-native';
import {geoDistanceFt, getUgaData, getAccData, getArrivals} from './fetch';


import * as Location from 'expo-location';

function formatTime(date) {
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
}

function formatTimeSpan(date) {
  let value = date.valueOf() - Date.now();
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
}

function FancyLabel({route}) {
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
}

function StopCard({arrivals}) {
  const [expanded, setExpanded] = useState(false);
  const stop = arrivals[0].stop;
  const arrivalLine = (arrival) => {
    return (
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <FancyLabel route={arrival.route}/>
        <Text> {formatTimeSpan(arrival.date)} ({formatTime(arrival.date)})</Text>
      </View>
    );
  };
  return (
    <Pressable onPress={() => setExpanded(!expanded)}>
      <View style={{
        borderColor: 'black',
        borderWidth: 1,
        borderRadius: 10,
        padding: 5,
      }}>
        <Text style={{fontWeight: 'bold'}}>{stop.name}</Text>
        <Text>{Math.round(stop.distanceFt)} ft away</Text>
        {arrivalLine(arrivals[0])}
        {arrivals.length > 1 && (
          expanded ? (
            <FlatList
              data={arrivals.slice(1)}
              keyExtractor={(arrival) => arrival.date.valueOf()}
              renderItem={({item}) => arrivalLine(item)}
            />
          ) : (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <FlatList
                style={{flexGrow: 0}}
                horizontal={true}
                data={arrivals.slice(1)}
                keyExtractor={(arrival) => arrival.date.valueOf()}
                renderItem={({item}) => <FancyLabel route={item.route}/>}
              />
              <Text> scheduled...</Text>
            </View>
          )
        )}
      </View>
    </Pressable>
  );
}

const App = () => {
  const [isLoading, setLoading] = useState(true);
  const [arrivalStops, setArrivalStops] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [location, setLocation] = useState([]);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    const getLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
  
        if (status !== "granted") {
          setLocationError("Location permission denied");
          return;
        }
  
        let gps = await Location.getCurrentPositionAsync({});
        setLocation([gps.coords.latitude, gps.coords.longitude]);
        setLocationPermission(true);
        console.log([gps.coords.latitude, gps.coords.longitude]);
      } catch (error) {
        console.error("Error requesting location permission:", error);
      }
    };
  
    getLocation();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getArrivalStops();
  }, []);

  const timeBase = Date.now();

  const getArrivalStops = async () => {
    try {
      const uga = await getUgaData();
      const acc = await getAccData();
      const routes = [...uga.routes.values(), ...acc.routes.values()];
      const stops = [...uga.stops.values(), ...acc.stops.values()];
      const userPos = [location.latitude, location.longitude];
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
      setRefreshing(false);
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
          ItemSeparatorComponent={() => <View style={{height: 5}}></View>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
          data={arrivalStops}
          keyExtractor={(arrivals) => arrivals[0].stop.id}
          renderItem={({item}) => <StopCard arrivals={item}/>}
        />
      )}
    </View>
  );
};

export default App;
