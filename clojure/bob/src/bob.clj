(ns bob
  (:require [clojure.string :as str]))

(defn yelling? [s] (and (= (str/lower-case s) s) (= (str/upper-case s) s)))

(defn question? [s] (str/ends-with? s "?"))

(defn response-for [s] (binding [message (str/trim s)] (cond
                                                         (and (yelling? message) (question? message)) "Calm down, I know what I'm doing!"
                                                         (yelling? message) "Whoa, chill out!"
                                                         (question? message) "Sure."
                                                         (str/blank? message) "Fine. Be that way!"
                                                         :else "Whatever.")))